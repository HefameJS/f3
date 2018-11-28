
// const mongourl = 'mongodb://fedicom:fedicom@hhub1.hefame.es:27017,hhub2.hefame.es:27017,hhub3.hefame.es:27017/fedicom?replicaSet=rs0';

const mongourl = require('../config').getMongoUrl();
const dbName = require('../config').mongodb.database;

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const client = new MongoClient(mongourl, {useNewUrlParser: true});
var	db, collection;

var memCache = require('memory-cache');
var commitBuffer = new memCache.Cache();


// Use connect method to connect to the Server
client.connect(function(err) {
	if (err) {
		console.log("NOT Connected");
		console.log(err);
	}
	else {

		console.log("Connected successfully to server");
		db = client.db(dbName);
		collection = db.collection("pedidos");
	}
});

exports.ObjectID = ObjectID;

exports.findTxByCrc = function(ped, cb) {
	if (client.isConnected() ) {
		console.log("Buscando pedido con CRC " + ped.crc);
		collection.findOne( {crc: new ObjectID(ped.crc)}, cb );
	} else {
		console.log('Not connected to mongo');
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
	console.log("COMMIT " + key);
	console.log("================================");
	console.log(data);
	console.log("================================");

	var cachedData = commitBuffer.get(key);
	if (cachedData && !noMerge) {
		console.log("AGREGANDO CON DATOS PREEXISTENTES");
		console.log("---------------");
		console.log(cachedData);
		console.log("---------------");
	}

	if (!noMerge)
		data = mergeDataWithCache(cachedData, data);

	if (client.isConnected() ) {
	   collection.updateOne( {_id: key }, data, {upsert: true}, function(err, res) {
			if (err) {
				console.log("Hubo un error al insertar");
				console.log(err);
				return;
			}

			if (cachedData) {
				console.log("LIMPIAMOS BUFFER KEY " + key);
				commitBuffer.del(key);
			}


	   });
	}
	else {
	   console.log(reqData);
	}

};


exports.buffer = function(data) {

	var key = data['$setOnInsert']._id ;

	console.log("AÑAIDIENDO DATOS AL BUFFER " + key);
	console.log("================================");
	console.log(data);
	console.log("================================");

	var cachedData = commitBuffer.get(key);

	console.log("AGREGANDO CON DATOS PREEXISTENTES");
	console.log("---------------");
	console.log(cachedData);
	console.log("---------------");

	var mergedData = mergeDataWithCache(cachedData, data);
	commitBuffer.put(key, mergedData, 5000, function (key, value) {
		exports.commit(value, false);
	});

	console.log("BUFFER ACTUAL PARA " + key);
	console.log(commitBuffer.get(key));



}
