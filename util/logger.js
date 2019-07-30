'use strict';
const BASE = global.BASE;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');
var conf = global.config;

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

if (process.title === 'fedicom3-watchdog') {
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


var L = module.exports;

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const mongoURL = conf.getMongoUrl();
const client = new MongoClient(mongoURL, {
	useNewUrlParser: true,
	autoReconnect: true
});

var collection;

client.connect(function(err, db) {
	if (err) {
		 L.f(['*** NO SE PUDO CONECTAR A MONGODB PARA EL ALMACENAMIENTO DE LOGS ***', mongoURL, err]);
	}
	else {
		var db = client.db(conf.mongodb.database);
		var colName = conf.mongodb.logCollection || 'log';
		collection = db.collection(colName);
		L.i(['*** Conectado a la colección [' + conf.mongodb.database + '.' + colName + '] para almacenamiento de logs'], 'logs');
	}
});

function writeMongo(event) {
	var prepend = '> ';
	if (collection) {
		collection.insertOne(event, { w: 0 });
	} else {
		prepend = 'E ';
	}

	if (event.tx)
		console.log(prepend + '[' + event.timestamp.toISOString() + '][' + event.level + '][' + event.tx.toString() + '][' + event.category + '] ' + event.data);
	else
		console.log(prepend + '[' + event.timestamp.toISOString() + '][' + event.level + '][' + event.category + '] ' + event.data);

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
}

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
}
