'use strict';
// const BASE = global.BASE;
const config = global.config;


module.exports = {
	t: function (data, category) { writeServer(data, 1000, category); },
	xt: function (id, data, category) { writeTx(id, data, 1000, category); },

	d: function (data, category) { writeServer(data, 3000, category); },
	xd: function (id, data, category) { writeTx(id, data, 3000, category); },

	i: function (data, category) { writeServer(data, 5000, category); },
	xi: function (id, data, category) { writeTx(id, data, 5000, category); },

	w: function (data, category) { writeServer(data, 7000, category); },
	xw: function (id, data, category) { writeTx(id, data, 7000, category); },

	e: function (data, category) { writeServer(data, 9000, category); },
	xe: function (id, data, category) { writeTx(id, data, 9000, category); },

	f: function (data, category) { writeServer(data, 10000, category); },
	xf: function (id, data, category) { writeTx(id, data, 10000, category); },

	yell: function (txId, txType, txStat, data) {
		if (!Array.isArray(data)) data = [data];

		var event = {
			tx: txId,
			yell: true,
			txType: txType,
			txStatus: txStat,
			data: data,
			timestamp: new Date()
		};
		writeMongo(event);
	},

};
// YO SOY L !
const L = module.exports;

if (process.title === global.WATCHDOG_TITLE) {
	module.exports = {
		t: function (data, category) { writeServer(data, 1000, category ? 'watchdog-' + category : 'watchdog'); },
		xt: function (id, data, category) { writeTx(id, data, 1000, category ? 'watchdog-' + category : 'watchdog'); },

		d: function (data, category) { writeServer(data, 3000, category ? 'watchdog-' + category : 'watchdog'); },
		xd: function (id, data, category) { writeTx(id, data, 3000, category ? 'watchdog-' + category : 'watchdog'); },

		i: function (data, category) { writeServer(data, 5000, category ? 'watchdog-' + category : 'watchdog'); },
		xi: function (id, data, category) { writeTx(id, data, 5000, category ? 'watchdog-' + category : 'watchdog'); },

		w: function (data, category) { writeServer(data, 7000, category ? 'watchdog-' + category : 'watchdog'); },
		xw: function (id, data, category) { writeTx(id, data, 7000, category ? 'watchdog-' + category : 'watchdog'); },

		e: function (data, category) { writeServer(data, 9000, category ? 'watchdog-' + category : 'watchdog'); },
		xe: function (id, data, category) { writeTx(id, data, 9000, category ? 'watchdog-' + category : 'watchdog'); },

		f: function (data, category) { writeServer(data, 10000, category ? 'watchdog-' + category : 'watchdog'); },
		xf: function (id, data, category) { writeTx(id, data, 10000, category ? 'watchdog-' + category : 'watchdog'); },

		yell: function (txId, txType, txStat, data) {
			if (!Array.isArray(data)) data = [data];

			var event = {
				tx: txId,
				yell: true,
				txType: txType,
				txStatus: txStat,
				data: data,
				timestamp: new Date()
			};
			writeMongo(event);
		},
	};
}

const cluster = require('cluster');
const mongourl = config.getMongoLogUrl();
const dbName = config.mongodb.database;
const MongoClient = require('mongodb').MongoClient;
const WRITE_CONCERN = 0;

const MONGODB_OPTIONS = {
	useNewUrlParser: true,
	autoReconnect: true,
	keepAlive: 1000,
	keepAliveInitialDelay: 1000,
	connectTimeoutMS: 1500,
	socketTimeoutMS: 1500,
	serverSelectionTimeoutMS: 1500,
	reconnectTries: 99999,
	reconnectInterval: 5000,
	ha: false,
	w: WRITE_CONCERN,
	wtimeout: 1000,
	j: 1000,
	replicaSet: config.mongodb.replicaSet,
	useUnifiedTopology: true,
	appname: global.instanceID + 'log',
	loggerLevel: 'warn'
};


var mongoConnection = null;
var mongoClient = null;
var mongoDatabase = null;
var collections = {
	log: null
};

const mongoConnect = () => {
	mongoConnection = new MongoClient(mongourl, MONGODB_OPTIONS);
	mongoConnection.connect()
		.then((client) => {
			mongoClient = client;
			mongoDatabase = mongoClient.db(dbName);
			L.i(['*** Conexión a la base de datos [' + dbName + '] para almacenamiento de logs'], 'mongodb');

			var logCollectionName = config.mongodb.logCollection || 'log';
			collections.log = mongoDatabase.collection(logCollectionName);
			L.i(['*** Conexión a la colección [' + dbName + '.' + logCollectionName + '] para almacenamiento de logs'], 'mongodb');
		})
		.catch((error) => {
			L.f(['*** Error en la conexión a de MongoDB para LOGS ***', mongourl, error], 'mongodb');
		});
}


mongoConnect();


function writeMongo(event) {
	if (collections.log) {
		collections.log.insertOne(event, { w: WRITE_CONCERN });
	}

	var workerId = cluster.isMaster ? 'master' : 'th#' + cluster.worker.id;
	if (!event.tx) { // Logs a nivel del global los mandamos a consola
		console.log('[' + workerId + '][' + event.timestamp.toISOString() + '][' + event.level + '][' + event.category + '] ' + event.data);
	} else {
		console.log('[' + workerId + '][' + event.timestamp.toISOString() + '][' + event.level + '][' + event.tx.toString() + '][' + event.category + '] ' + event.data);
	}

}

function writeServer(data, level, category) {
	if (!Array.isArray(data)) data = [data];

	var event = {
		category: category || 'server' ,
		level: level || 5000,
		data: data,
		timestamp: new Date()
	}
	writeMongo(event);
};

function writeTx(id, data, level, category) {
	if (!Array.isArray(data)) data = [data];

	var event = {
		tx: id,
		category: category || 'tx' ,
		level: level || 5000,
		data: data,
		timestamp: new Date()
	};
	writeMongo(event);
};
