
const mongourl = 'mongodb://fedicom:fedicom@hhub1.hefame.es:27017,hhub2.hefame.es:27017,hhub3.hefame.es:27017/fedicom?replicaSet=rs0';
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const dbName = 'fedicom';
const client = new MongoClient(mongourl, {useNewUrlParser: true});
var	db, collection;

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




exports.commit = function(data) {

	console.log("COMMIT");
	console.log("================================");
	console.log(data);
	console.log("================================");

	if (client.isConnected() ) {
	   collection.updateOne( {_id: data['$setOnInsert']._id }, data, {upsert: true}, function(err, res) {
			if (err) {
				console.log("Hubo un error al insertar");
				console.log(err);
				return;
			}
	   });
	}
	else {
	   console.log(reqData);
	}
};
