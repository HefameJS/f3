'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const mongourl = config.getMongoUrl();
const dbName = config.mongodb.database;

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const client = new MongoClient(mongourl, {
	useNewUrlParser: true,
	autoReconnect: true
});
var	db, collection;

var memCache = require('memory-cache');
var commitBuffer = new memCache.Cache();

const iSqlite = require(BASE + 'interfaces/isqlite');


// Use connect method to connect to the Server
client.connect(function(err) {
	if (err) {
		L.f(['*** NO SE PUDO CONECTAR A MONGODB ***', mongourl, err]);
	}
	else {
		L.i(['*** Conectado a la colección [' + dbName + '.' + config.mongodb.txCollection + '] para almacenamiento de transmisiones']);
		db = client.db(dbName);
		collection = db.collection(config.mongodb.txCollection);
	}
});

exports.ObjectID = ObjectID;

exports.findTxByCrc = function(tx, cb) {
	if (client.isConnected() ) {
		var crc;
		try {
			if (tx.crc)	crc = new ObjectID(tx.crc);
			else crc = new ObjectID(tx);
		} catch (ex) {
			L.xe(tx, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC', ex], 'crc');
			cb(ex, null);
			return;
		}
		collection.findOne( {crc: crc}, cb );
	} else {
		L.xe(tx, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC, NO ESTA CONECTADO A MONGO'], 'crc');
		cb({error: "No conectado a MongoDB"}, null);
	}
};


function mergeDataWithCache(oldData, newData) {
	if (oldData) {
		if (!oldData['$setOnInsert']) {
			oldData['$setOnInsert'] = newData['$setOnInsert'];
		} else {
			for (var value in newData['$setOnInsert']) {
				oldData['$setOnInsert'][value] = newData['$setOnInsert'][value]
			}
		}

		if (newData['$set']) {
			if (oldData['$set']) {
				for (var value in newData['$set']) {
					oldData['$set'][value] = newData['$set'][value];
				}
			} else {
				oldData['$set'] = newData['$set'];
			}
		}

		return oldData;
	} else {
		return newData;
	}
}


exports.commit = function(data, noMerge) {

	var key = data['$setOnInsert']._id ;

	var cachedData = commitBuffer.get(key);

	if (cachedData && !noMerge) {
		L.xt(key, ['Agregando con datos en cache', {set: cachedData['$set'], push: cachedData['push']}], 'txBuffer');
		data = mergeDataWithCache(cachedData, data);
	}


	if (client.isConnected() ) {
	   collection.updateOne( {_id: key }, data, {upsert: true}, function(err, res) {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT', err], 'txCommit');
				iSqlite.storeTx(data);
			} else {
				L.xd(key, ['COMMIT realizado', {set: data['$set'], push: data['push']}], 'txCommit');
			}
	   });
	}
	else {
	   L.xf(key, ['ERROR AL HACER COMMIT', {set: data['$set'], push: data['push']}], 'txCommit');
		iSqlite.storeTx(data);
	}

	if (cachedData) {
		L.xt(key, ['Limpiando entrada de cache'], 'txCommit');
		commitBuffer.del(key);
	}

};


exports.buffer = function(data) {

	var key = data['$setOnInsert']._id ;

	L.xd(key, ['Añadiendo datos al buffer', {set: data['$set'], push: data['push']}], 'txBuffer');

	var cachedData = commitBuffer.get(key);
	var mergedData = mergeDataWithCache(cachedData, data);
	commitBuffer.put(key, mergedData, 5000, function /*onTimeout*/ (key, value) {
		L.xw(key, ['Forzando COMMIT por timeout'], 'txCommit');
		exports.commit(value, false);
	});

	L.xt(key, ['Datos actuales del buffer', {set: mergedData['$set'], push: mergedData['push']}], 'txBuffer');


}
