var conf = global.config;



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
		var db = client.db(conf.mongodb.database);
		collection = db.collection(conf.mongodb.logCollection || 'log');
		console.log('[%s] *** Guardando logs en la colección %s.%s de MongoDB.', (new Date()).toISOString(), conf.mongodb.database, conf.mongodb.logCollection || 'log' );
	}
});

function writeMongo(event) {
	if (collection) {
		collection.insertOne(event, { w: 0 });
	} else {
		// Write temp ?
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
	if (!Array.isArray(data)) data = [data];

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
	if (!Array.isArray(data)) data = [data];

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
