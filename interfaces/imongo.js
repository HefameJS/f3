'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const mongourl = config.getMongoUrl();
const dbName = config.mongodb.database;

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');

const NUM_CONN = config.mongodb.connections || 10;
const WRITE_CONCERN = config.mongodb.writeconcern || 1;
var lastConnIndex = -1;
const clientPool = [];

const connectInstance = function(i) {
	clientPool[i] = {
		client: new MongoClient(mongourl, {
			useNewUrlParser: true,
			autoReconnect: true
		}),
		db: null,
		collection: null
	};

	clientPool[i].client.connect(function(err) {
		if (err) {
			L.f(['*** Error en la conexión #' + i + ' de MongoDB ***', mongourl, err], 'mongodb');
		}
		else {
			L.i(['*** Conexión #' + i + ' a la colección [' + dbName + '.' + config.mongodb.txCollection + '] para almacenamiento de transmisiones'], 'mongodb');
			clientPool[i].db = clientPool[i].client.db(dbName);
			clientPool[i].collection = clientPool[i].db.collection(config.mongodb.txCollection);
		}
	});
}
for (var i = 0 ; i < NUM_CONN ; i++) {
	connectInstance(i);
}

function getDB() {
	if (!clientPool.length) return null;
	lastConnIndex = (++lastConnIndex) % clientPool.length;
	var conn = clientPool[lastConnIndex];
	if (conn.client.isConnected())
		return conn;
	return null;
}


var memCache = require('memory-cache');
var commitBuffer = new memCache.Cache();

const iSqlite = require(BASE + 'interfaces/isqlite');



exports.ObjectID = ObjectID;

exports.connectionStatus = function() {
	var connections = {};
	clientPool.forEach( function (connection, i) {
		connections[i] = {
			connected: connection.client.isConnected()
		}
	});
	return connections;
}

exports.findTxById= function(txId, id, cb) {
	var db = getDB();
	if (db) {
		try {
			id = new ObjectID(id);
		} catch (ex) {
			L.xe(txId, ['**** Error al buscar la transmisión por ID', id, ex]);
			cb(ex, null);
			return;
		}
		db.collection.findOne( {_id: id}, cb );
	} else {
		L.xe(txId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({error: "No conectado a MongoDB"}, null);
	}
};
exports.findTxByCrc = function(tx, cb) {
	var db = getDB();
	if (db) {
		var crc;
		try {
			if (tx.crc)	crc = new ObjectID(tx.crc);
			else crc = new ObjectID(tx);
		} catch (ex) {
			L.xe(tx, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC', ex], 'crc');
			cb(ex, null);
			return;
		}
		db.collection.findOne( {crc: crc}, cb );
	} else {
		L.xe(tx, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC, NO ESTA CONECTADO A MONGO'], 'crc');
		cb({error: "No conectado a MongoDB"}, null);
	}
};
exports.findTxByNumeroDevolucion = function(txId, numeroDevolucion, cb) {
	var db = getDB();
	if (db) {
		L.xd(txId, ['Consulta MDB', {type: txTypes.CREAR_DEVOLUCION, numerosDevolucion: numeroDevolucion}], 'mongodb');
		db.collection.findOne( {type: txTypes.CREAR_DEVOLUCION, numerosDevolucion: numeroDevolucion}, cb );
	} else {
		L.xe(txId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({error: "No conectado a MongoDB"}, null);
	}
};
exports.findTxByNumeroPedido = function(txId, numeroPedido, cb) {
	var db = getDB();
	if (db) {
		L.xd(txId, ['Consulta MDB', {type: txTypes.CREAR_PEDIDO, numerosPedido: numeroPedido}], 'mongodb');
		db.collection.findOne( {type: txTypes.CREAR_PEDIDO, numerosPedido: numeroPedido}, cb );
	} else {
		L.xe(txId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({error: "No conectado a MongoDB"}, null);
	}
};

/*	Obtiene las transmisiones que son candidatas de retransmitir */
exports.findCandidatosRetransmision = function(limit, cb) {
	var db = getDB();
	if (db) {
		var query1 = {
			type: txTypes.CREAR_PEDIDO,
			status: txStatus.NO_SAP
		};
		var query2 = {
			type: txTypes.CREAR_PEDIDO,
			status: {'$in': [txStatus.RECEPCIONADO, txStatus.ESPERANDO_INCIDENCIAS, txStatus.INCIDENCIAS_RECIBIDAS, txStatus.ESPERANDO_NUMERO_PEDIDO]},
			modifiedAt: { $lt : new Date(Date.timestamp() - 1000 * 60 * 1) }
		};
		var query = {
			'$or': [query1, query2]
		};

		limit = limit ? limit : 10;
		
		L.d(['Consultando MDB por candidatos para retransmitir'], 'mongodb');
		db.collection.find(query).limit(limit).toArray(cb);
	} else {
		L.e(['**** Error al localizar la transmisión'], 'mongodb');
		cb({error: "No conectado a MongoDB"}, null);
	}
}

function mergeDataWithCache(oldData, newData) {
	if (oldData) {
		if (newData['$setOnInsert']) {
			if (oldData['$setOnInsert']) {
				for (var value in newData['$setOnInsert']) {
					oldData['$setOnInsert'][value] = newData['$setOnInsert'][value];
				}
			} else {
				oldData['$setOnInsert'] = newData['$setOnInsert'];
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

		if (newData['$push']) {
			if (oldData['$push']) {
				for (arrayName in newData['$push']) {
					if (oldData['$push'][arrayName]) {
						if (!oldData['$push'][arrayName]['$each'] || !oldData['$push'][arrayName]['$each'].push ) {
							oldData['$push'][arrayName] = {
								'$each': [ oldData['$push'][arrayName] ]
							};
						}
						if (newData['$push'][arrayName]['$each'] && newData['$push'][arrayName]['$each'].forEach) {
							newData['$push'][arrayName]['$each'].forEach( function (element) {
								oldData['$push'][arrayName]['$each'].push(element);
							});
						} else {
							oldData['$push'][arrayName]['$each'].push(newData['$push'][arrayName]);
						}
					} else {
						oldData['$push'][arrayName] = newData['$push'][arrayName];
					}
				}
			}
			else {
				oldData['$push'] = newData['$push'];
			}
		}

		//TODO: Hacer merge PUSH
		return oldData;
	} else {
		return newData;
	}
}

exports.commit = function(data, noMerge) {

	var key = data['$setOnInsert']._id ;

	var cachedData = commitBuffer.get(key);

	if (cachedData && !noMerge) {
		L.xt(key, ['Agregando con datos en cache', {setOnInsert: cachedData['$setOnInsert'], set: cachedData['$set'], push: cachedData['$push']}], 'txBuffer');
		data = mergeDataWithCache(cachedData, data);
	}

	var db = getDB();
	if (db) {
	   db.collection.updateOne( {_id: key }, data, {upsert: true, w: WRITE_CONCERN}, function(err, res) {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT', err], 'txCommit');
				iSqlite.storeTx(data);
			} else {
				L.xd(key, ['COMMIT realizado', {setOnInsert: data['$setOnInsert'], set: data['$set'], push: data['$push']}], 'txCommit');
			}
	   });
	}
	else {
	   L.xf(key, ['ERROR AL HACER COMMIT', {setOnInsert: data['$setOnInsert'], set: data['$set'], push: data['$push']}], 'txCommit');
		iSqlite.storeTx(data);
	}

	if (cachedData) {
		L.xt(key, ['Limpiando entrada de cache'], 'txCommit');
		commitBuffer.del(key);
	}

};


exports.buffer = function(data) {

	var key = data['$setOnInsert']._id ;

	L.xd(key, ['Añadiendo datos al buffer', {setOnInsert: data['$setOnInsert'], set: data['$set'], push: data['$push']}], 'txBuffer');

	var cachedData = commitBuffer.get(key);
	var mergedData = mergeDataWithCache(cachedData, data);
	commitBuffer.put(key, mergedData, 5000, function /*onTimeout*/ (key, value) {
		L.xw(key, ['Forzando COMMIT por timeout'], 'txCommit');
		exports.commit(value, false);
	});

	L.xt(key, ['Datos actuales del buffer', {setOnInsert: mergedData['$setOnInsert'], set: mergedData['$set'], push: mergedData['$push']}], 'txBuffer');


}
