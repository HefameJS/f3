
var log4js = require('log4js'),
mongoAppender = require('log4js-node-mongodb');

var conf = global.config;


/*
	event.data,
	event.startTime,
	event.level,
	event.category

*/
function insert(event) {




}


const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const mongoURL = conf.getMongoUrl();
const client = new MongoClient(mongoURL, { useNewUrlParser: true });

var collection;

client.connect(function(err, db) {
	if (err) {
		 console.error('*** NO SE PUDO CONECTAR A MONGODB !! - %s', mongoURL);
		 console.error(err);
	}
	else {
		console.log( (new Date()).toISOString() );
		console.log('Logger conectado a MongoDB [' + mongoURL + ']');
		console.log('Base de datos [' + conf.mongodb.database + '] colección ['+ (conf.mongodb.logCollection || 'log') + ']');
		var db = client.db(conf.mongodb.database);
		collection = db.collection(conf.mongodb.logCollection || 'log');
	}
});

function writeMongo(event) {
	if (collection) {
		collection.insertOne(event, { w: 0 });
	} else {
conf.mongodb.database
	}
}

function cleanKeys(data) {
	for (var key in obj) {
	    if (obj.hasOwnProperty(key)) {
	        /* useful code here */
	    }
	}
}

function writeServer(data, level, category) {
	var event = {
		category: category || 'server' ,
		level: level || 5000,
		data: data,
		timestamp: new Date()
	}
	writeMongo(event);
	console.log('[' + event.timestamp.toISOString() + '][' + event.level + '][' + event.category + '] ' + data);
}

function writeTx(id, data, level, category) {
	var event = {
		tx: id,
		category: category || 'tx' ,
		level: level || 5000,
		data: data,
		timestamp: new Date()
	};
	writeMongo(event);
	console.log('[' + event.timestamp.toISOString() + '][' + event.level + '][' + event.category + '] [' + event.tx.toString() + '] ' + data);
}


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
	xf: function (id, data, category) { writeTx(id, data, 10000, category); }
};
