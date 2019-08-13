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
exports.findCandidatosRetransmision = function(limit, minimumAge, cb) {
	var db = getDB();
	if (db) {
		var query1 = {
			type: txTypes.CREAR_PEDIDO,
			status: txStatus.NO_SAP
		};
		var query2 = {
			type: txTypes.CREAR_PEDIDO,
			status: {'$in': [txStatus.RECEPCIONADO, txStatus.ESPERANDO_INCIDENCIAS, txStatus.INCIDENCIAS_RECIBIDAS, txStatus.ESPERANDO_NUMERO_PEDIDO]},
			modifiedAt: { $lt : new Date(Date.timestamp() - (1000 * minimumAge) ) }
		};
		var query = {
			'$or': [query1, query2]
		};

		limit = limit ? limit : 10;

		// L.d(['Consultando MDB por candidatos para retransmitir'], 'mongodb');
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

		if (newData['$max']) {
			if (oldData['$max']) {
				for (var value in newData['$max']) {
					oldData['$max'][value] = newData['$max'][value];
				}
			} else {
				oldData['$max'] = newData['$max'];
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

function toLogStructure(data) {
	return {
		setOnInsert: data['$setOnInsert'],
		max: data['$max'],
		set: data['$set'],
		push: data['$push']
	}
}

exports.commit = function(data, noMerge) {

	var key = data['$setOnInsert']._id ;

	var cachedData = commitBuffer.get(key);
	if (cachedData && !noMerge) {
		data = mergeDataWithCache(cachedData, data);
	}

	var db = getDB();
	if (db) {
	   db.collection.updateOne( {_id: key }, data, {upsert: true, w: WRITE_CONCERN}, function(err, res) {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT', err], 'mdbCommit');
				iSqlite.storeTx(data);
			} else {
				L.xd(key, ['COMMIT OK', toLogStructure(data)], 'mdbCommit');
			}
	   });
	}
	else {
	   L.xf(key, ['ERROR AL HACER COMMIT', toLogStructure(data)], 'mdbCommit');
		iSqlite.storeTx(data);
	}

	if (cachedData) {
		commitBuffer.del(key);
	}

};


exports.buffer = function(data) {

	var key = data['$setOnInsert']._id ;

	L.xd(key, ['BUFFER OK', toLogStructure(data)], 'mdbBuffer');

	var cachedData = commitBuffer.get(key);
	var mergedData = mergeDataWithCache(cachedData, data);
	commitBuffer.put(key, mergedData, 5000, function /*onTimeout*/ (key, value) {
		L.xw(key, ['Forzando COMMIT por timeout'], 'mdbBuffer');
		exports.commit(value, false);
	});

}


function convertToOidsAndDates(data) {
	if (data['$setOnInsert']) {
		var setOI = data['$setOnInsert'];
		if (setOI._id) setOI._id = new ObjectID(setOI._id);
		if (setOI.originalTx) setOI.originalTx = new ObjectID(setOI.originalTx);
		if (setOI.confirmingId) setOI.originalTx = new ObjectID(setOI.originalTx);
		if (setOI.createdAt) setOI.createdAt = new Date(setOI.createdAt);
	}

	if (data['$max']) {
		var max = data['$max'];
		if (max.modifiedAt) max.modifiedAt = new Date(max.modifiedAt);
	}

	if (data['$set']) {
		var set = data['$set'];
		if (set.crc) set.crc = new ObjectID(set.crc);
		if (set.sapRequest && set.sapRequest.timestamp) set.sapRequest.timestamp = new Date(set.sapRequest.timestamp);
		if (set.sapResponse && set.sapResponse.timestamp) set.sapResponse.timestamp = new Date(set.sapResponse.timestamp);
		if (set.clientResponse && set.clientResponse.timestamp) set.clientResponse.timestamp = new Date(set.clientResponse.timestamp);
	}

	if (data['$push']) {
		var push = data['$push'];
		if (push.retransmissions && push.retransmissions.length) {
			push.retransmissions.forEach( function (o) {
				if (o._id) o._id = new ObjectID(o._id);
				if (o.createdAt) o.createdAt = new Date(o.createdAt);
				if (o.oldClientResponse && o.oldClientResponse.timestamp) o.oldClientResponse.timestamp = new Date(o.oldClientResponse.timestamp);
			})
		}
		if (push.sapConfirms && push.sapConfirms.length) {
			push.sapConfirms.forEach( function (o) {
				if (o.txId) o.txId = new ObjectID(o.txId);
				if (o.timestamp) o.timestamp = new Date(o.timestamp);
			})
		}
		if (push.duplicates && push.duplicates.length) {
			push.duplicates.forEach( function (o) {
				if (o._id) o._id = new ObjectID(o._id);
				if (o.createdAt) o.createdAt = new Date(o.createdAt);
				if (o.originalTx) o.originalTx = new ObjectID(o.originalTx);
				if (o.clientResponse && o.clientResponse.timestamp) o.clientResponse.timestamp = new Date(o.clientResponse.timestamp);
			})
		}
	}

	// TODO: Hay que convertir a OID todos los campos necesarios, ya que se guardan como string en Sqlite
}


exports.updateFromSqlite = function(data, cb) {

	convertToOidsAndDates(data);
	var key = data['$setOnInsert']._id ;

	var db = getDB();
	if (db) {
	   db.collection.updateOne( {_id: key}, data, {upsert: true, w: WRITE_CONCERN}, function(err, res) {
			if (err) {
				L.xe(key, ['** Error al actualizar desde SQLite', err], 'txSqliteCommit');
				cb(false);
			} else {
				L.xd(key, ['COMMIT desde SQLite OK', toLogStructure(data)], 'txSqliteCommit');
				cb(true);
			}
	   });
	}
	else {
	   L.xe(key, ['** No conectado a MongoDB'], 'txSqliteCommit');
		cb(false);
	}

};
