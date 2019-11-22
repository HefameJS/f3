'use strict';
// const BASE = global.BASE;
const C = global.config;
var L = {};
//const K = global.constants;



const cluster = require('cluster');
const mongourl = C.getMongoLogUrl();
const dbName = C.mongodb.database;
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



const writeMongo = (event) => {
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

const writeServer = (data, level, category) => {
	if (!Array.isArray(data)) data = [data];

	var event = {
		category: category || 'server' ,
		level: level || 5000,
		data: data,
		timestamp: new Date()
	}
	writeMongo(event);
};

const writeTx = (id, data, level, category) => {
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

const saneaEstructuraDeCommit = (data) => {
	return {
		setOnInsert: data['$setOnInsert'],
		max: data['$max'],
		set: data['$set'],
		push: data['$push']
	}
}

const yell = (txId, txType, txStat, data) => {
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
}



L = {
	t: (data, category) => writeServer(data, 1000, category),
	d: (data, category) => writeServer(data, 3000, category),
	i: (data, category) => writeServer(data, 5000, category),
	w: (data, category) => writeServer(data, 7000, category),
	e: (data, category) => writeServer(data, 9000, category),
	f: (data, category) => writeServer(data, 10000, category),
	xt: (id, data, category) => writeTx(id, data, 1000, category),
	xd: (id, data, category) => writeTx(id, data, 3000, category),
	xi: (id, data, category) => writeTx(id, data, 5000, category),
	xw: (id, data, category) => writeTx(id, data, 7000, category),
	xe: (id, data, category) => writeTx(id, data, 9000, category),
	xf: (id, data, category) => writeTx(id, data, 10000, category),
	yell: yell,
	saneaCommit: saneaEstructuraDeCommit
};

if (process.title === global.WATCHDOG_TITLE) {
	var wdCategory = (category) => category ? 'watchdog-' + category : 'watchdog';
	L = {
		t: (data, category) => writeServer(data, 1000, wdCategory(category)),
		d: (data, category) => writeServer(data, 3000, wdCategory(category)),
		i: (data, category) => writeServer(data, 5000, wdCategory(category)),
		w: (data, category) => writeServer(data, 7000, wdCategory(category)),
		e: (data, category) => writeServer(data, 9000, wdCategory(category)),
		f: (data, category) => writeServer(data, 10000, wdCategory(category)),
		xt: (id, data, category) => writeTx(id, data, 1000, wdCategory(category)),
		xd: (id, data, category) => writeTx(id, data, 3000, wdCategory(category)),
		xi: (id, data, category) => writeTx(id, data, 5000, wdCategory(category)),
		xw: (id, data, category) => writeTx(id, data, 7000, wdCategory(category)),
		xe: (id, data, category) => writeTx(id, data, 9000, wdCategory(category)),
		xf: (id, data, category) => writeTx(id, data, 10000, wdCategory(category)),

		yell: yell,
		saneaCommit: saneaEstructuraDeCommit
	};
}

module.exports = L;