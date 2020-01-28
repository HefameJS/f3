'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;


const mongourl = C.getMongoUrl();
const dbName = C.mongodb.database;

var memCache = require('memory-cache');
const commitBuffer = new memCache.Cache();
const iSqlite = require(BASE + 'interfaces/isqlite');


const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;

const WRITE_CONCERN = C.mongodb.writeconcern || 1;

const MONGODB_OPTIONS = {
	useNewUrlParser: true,
	keepAlive: 1000,
	keepAliveInitialDelay: 1000,
	connectTimeoutMS: 1500,
	socketTimeoutMS: 1500,
	serverSelectionTimeoutMS: 1500,
	ha: false,
	w: C.mongodb.writeconcern || 1,
	wtimeout: 1000,
	j: 1000,
	useUnifiedTopology: true,
	appname: global.instanceID,
	loggerLevel: 'warn'
};


var mongoConnection = null;
var mongoClient = null;
var mongoDatabase = null;
var collections = {
	tx: null,
	discard: null,
	control: null
};

const mongoConnect = () => {
	mongoConnection = new MongoClient(mongourl, MONGODB_OPTIONS);
	mongoConnection.connect()
		.then((client) => {
			mongoClient = client;
			mongoDatabase = mongoClient.db(dbName);
			L.i(['*** Conexión a la base de datos [' + dbName + ']'], 'mongodb');

			var txCollectionName = C.mongodb.txCollection || 'tx';
			collections.tx = mongoDatabase.collection(txCollectionName);
			L.i(['*** Conexión a la colección [' + dbName + '.' + txCollectionName + '] para almacenamiento de transmisiones'], 'mongodb');

			var discardCollectionName = C.mongodb.discardCollection || 'discard';
			collections.discard = mongoDatabase.collection(discardCollectionName);
			L.i(['*** Conexión a la colección [' + dbName + '.' + discardCollectionName + '] para almacenamiento de transmisiones descartadas'], 'mongodb');

			if (process.title === K.PROCESS_TITLES.WATCHDOG) {
				var controlCollectionName = C.mongodb.controlCollection || 'control';
				collections.control = mongoDatabase.collection(controlCollectionName);
				L.i(['*** Conexión a la colección [' + dbName + '.' + controlCollectionName + '] para control'], 'mongodb');
			}

			if (process.title === K.PROCESS_TITLES.MONITOR) {
				/*var querysCollectionName = C.mongodb.querysCollection || 'querys';
				collections.querys = mongoDatabase.collection(querysCollectionName);
				L.i(['*** Conexión a la colección [' + dbName + '.' + querysCollectionName + '] para querys'], 'mongodb');*/
			}
		})
		.catch(error => L.f(['*** Error en la conexión a de MongoDB ***', mongourl, error], 'mongodb'));
}

mongoConnect();

/**
 * 
 * @param {Parámetros de la consulta} query 
 * @param {*} callback 
 */
const consultaTX = (query, callback) => {

	let filter = query.filter || {};
	let projection = query.projection || null;
	let sort = query.sort || null;
	let skip = query.skip || 0;
	let limit = query.limit || 100;
	limit = Math.min(limit, 100);


	

	try {
		if (filter._id) {
			if (filter._id.$in) filter._id.$in = filter._id.$in.map( id => new ObjectID(id))
			else if (filter._id.$nin) filter._id.$nin = filter._id.$nin.map(id => new ObjectID(id))
			else filter._id = new ObjectID(filter._id);
		}
	} catch (e) { console.log(e) }
	try {
		if (filter.crc) {
			if (filter.crc.$in) filter.crc.$in = filter.crc.$in.map(id => new ObjectID(id))
			else if (filter.crc.$nin) filter.crc.$nin = filter.crc.$nin.map(id => new ObjectID(id))
			else filter.crc = new ObjectID(filter.crc);
		}
	} catch (e) { console.log(e) }

	try {
		if (filter.createdAt) {
			if (filter.createdAt.$gte) filter.createdAt.$gte = new Date(filter.createdAt.$gte)
			if (filter.createdAt.$lte) filter.createdAt.$lte = new Date(filter.createdAt.$lte)
		}
	} catch (e) { console.log(e) }

	if (filter.$or && filter.$or.length === 0) delete filter.$or;

	if (mongoClient) {
		let cursor = collections.tx.find(filter);
		if (projection) cursor.project(projection);
		if (sort) cursor.sort(sort);
		if (skip) cursor.skip(skip);
		if (limit) cursor.limit(limit);

		cursor.count(false, (err, count) => {
			if (err) return callback(err, null);

			cursor.toArray((err, result) => {
				if (err) return callback(err, null);

				return callback(null, {
					data: result,
					size: result.length,
					limit: limit,
					skip: skip,
					total: count
				});

			});
		});


	} else {
		callback({ error: "No conectado a MongoDB" }, null);
	}


}

const connectionStatus = (cb) => {
	if (mongoClient && mongoClient.isConnected()) {
		collections.tx.findOne({}, { _id: 1 }, (err, res) => {
			if (err) {
				mongoConnect();
				return cb(false);
			}
			return cb(true);
		});
	} else {
		mongoConnect();
		return cb(false);
	}
}
const findTxById = (myId, id, cb) => {
	if (mongoClient && mongoClient.isConnected()) {
		try {
			id = new ObjectID(id);
		} catch (ex) {
			L.xe(myId, ['**** Error al buscar la transmisión por ID', id, ex]);
			cb(ex, null);
			return;
		}
		collections.tx.findOne({ _id: id }, cb);
	} else {
		L.xe(myId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};
const findTxByCrc = (myId, crc, cb) => {

	if (mongoClient && mongoClient.isConnected()) {
		try {
			if (crc.crc) crc = new ObjectID(crc.crc);
			else crc = new ObjectID(crc);

			collections.tx.findOne({ crc: crc }, cb);

		} catch (ex) {
			L.xe(myId, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC', ex], 'crc');
			cb(ex, null);
			return;
		}

	} else {
		L.xe(myId, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC, NO ESTA CONECTADO A MONGO'], 'crc');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};
const findCrcDuplicado = (crc, cb) => {

	if (mongoClient && mongoClient.isConnected()) {
		try {
			crc = new ObjectID(crc);
			collections.tx.findOne({ crc: crc }, { _id: 1, crc: 1 }, cb);
		} catch (ex) {
			cb(ex, null);
			return;
		}

	} else {
		cb({ error: "No conectado a MongoDB" }, null);
	}
};
const findTxByNumeroDevolucion = (myId, numeroDevolucion, cb) => {
	if (mongoClient && mongoClient.isConnected()) {
		L.xd(myId, ['Consulta MDB', { type: K.TX_TYPES.DEVOLUCION, numerosDevolucion: numeroDevolucion }], 'mongodb');
		collections.tx.findOne({ type: K.TX_TYPES.DEVOLUCION, numerosDevolucion: numeroDevolucion }, cb);
	} else {
		L.xe(myId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};
const findTxByNumeroPedido = (myId, numeroPedido, cb) => {
	if (mongoClient && mongoClient.isConnected()) {
		L.xd(myId, ['Consulta MDB', { type: K.TX_TYPES.PEDIDO, numerosPedido: numeroPedido }], 'mongodb');
		collections.tx.findOne({ type: K.TX_TYPES.PEDIDO, numerosPedido: numeroPedido }, cb);
	} else {
		L.xe(myId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};
const findConfirmacionPedidoByCRC = (crc, cb) => {
	if (mongoClient && mongoClient.isConnected()) {
		crc = crc.substr(0, 8).toUpperCase();
		collections.tx.findOne({ type: K.TX_TYPES.CONFIRMACION_PEDIDO, "clientRequest.body.crc": crc }, cb);
	} else {
		cb({ error: "No conectado a MongoDB" }, null);
	}
};

/*	Obtiene las transmisiones que son candidatas de retransmitir */
const findCandidatosRetransmision = (limit, minimumAge, cb) => {
	if (mongoClient && mongoClient.isConnected()) {
		var query1 = {
			status: K.TX_STATUS.NO_SAP
		};
		var query2 = {
			status: { '$in': [K.TX_STATUS.RECEPCIONADO, K.TX_STATUS.ESPERANDO_INCIDENCIAS, K.TX_STATUS.INCIDENCIAS_RECIBIDAS, K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO] },
			modifiedAt: { $lt: new Date(Date.fedicomTimestamp() - (1000 * minimumAge)) }
		};
		var query = {
			type: K.TX_TYPES.PEDIDO,
			'$or': [query1, query2]
		};

		limit = limit ? limit : 10;

		L.t(['Consultando MDB por candidatos para retransmitir'], 'mongodb');
		collections.tx.find(query).limit(limit).toArray(cb);
	} else {
		L.e(['**** Error al buscar candidatos a retransmitir. No está conectado a mongodb'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
}

const commitDiscard = (data) => {

	var key = data['$setOnInsert']._id;


	if (mongoClient && mongoClient.isConnected()) {
		collections.discard.updateOne({ _id: key }, data, { upsert: true, w: 0 }, function (err, res) {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT DISCARD. SE IGNORA LA TRANSMISION', err], 'mdbCommitDiscard');
			} else {
				L.xd(key, ['COMMIT DISCARD OK', L.saneaCommit(data)], 'mdbCommitDiscard');
			}
		});
	}
	else {
		L.xf(key, ['ERROR AL HACER COMMIT DISCARD', L.saneaCommit(data)], 'mdbCommitDiscard');
	}

};

const commit = (data, noMerge) => {

	var key = data['$setOnInsert']._id;

	var cachedData = commitBuffer.get(key);
	if (cachedData && !noMerge) {
		data = mergeDataWithCache(cachedData, data);
	}


	if (mongoClient && mongoClient.isConnected()) {
		collections.tx.updateOne({ _id: key }, data, { upsert: true, w: WRITE_CONCERN }, (err, res) => {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT', err], 'mdbCommit');
				iSqlite.storeTx(data);
			} else {
				L.xd(key, ['COMMIT OK', L.saneaCommit(data)], 'mdbCommit');
			}
		});
	}
	else {
		L.xf(key, ['ERROR AL HACER COMMIT', L.saneaCommit(data)], 'mdbCommit');
		iSqlite.storeTx(data);
	}

	if (cachedData) {
		commitBuffer.del(key);
	}

};

const buffer = (data) => {

	var key = data['$setOnInsert']._id;

	L.xd(key, ['BUFFER OK', L.saneaCommit(data)], 'mdbBuffer');

	var cachedData = commitBuffer.get(key);
	var mergedData = mergeDataWithCache(cachedData, data);
	commitBuffer.put(key, mergedData, 5000, function /*onTimeout*/(key, value) {
		L.xw(key, ['Forzando COMMIT por timeout'], 'mdbBuffer');
		module.exports.commit(value, false);
	});

}

const updateFromSqlite = (data, cb) => {

	convertToOidsAndDates(data);
	var key = data['$setOnInsert']._id;

	if (!data.$set) 		data.$set = {};

	data.$set['flags.' + K.FLAGS.SQLITE] = true;
	

	if (mongoClient && mongoClient.isConnected()) {
		collections.tx.updateOne({ _id: key }, data, { upsert: true, w: WRITE_CONCERN }, function (err, res) {
			if (err) {
				L.xe(key, ['** Error al actualizar desde SQLite', err], 'txSqliteCommit');
				mongoConnect();
				cb(false);
			} else {
				L.xd(key, ['COMMIT desde SQLite OK', L.saneaCommit(data)], 'txSqliteCommit');
				cb(true);
			}
		});
	}
	else {
		L.xe(key, ['** No conectado a MongoDB'], 'txSqliteCommit');
		mongoConnect();
		cb(false);

	}

};

module.exports = {
	ObjectID,
	connectionStatus,
	findTxById,
	findTxByCrc,
	findCrcDuplicado,
	findTxByNumeroDevolucion,
	findTxByNumeroPedido,
	findConfirmacionPedidoByCRC,
	findCandidatosRetransmision,
	commitDiscard,
	commit,
	buffer,
	updateFromSqlite,

	consultaTX
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
			push.retransmissions.forEach(function (o) {
				if (o._id) o._id = new ObjectID(o._id);
				if (o.createdAt) o.createdAt = new Date(o.createdAt);
				if (o.oldClientResponse && o.oldClientResponse.timestamp) o.oldClientResponse.timestamp = new Date(o.oldClientResponse.timestamp);
			})
		}
		if (push.sapConfirms && push.sapConfirms.length) {
			push.sapConfirms.forEach(function (o) {
				if (o.txId) o.txId = new ObjectID(o.txId);
				if (o.timestamp) o.timestamp = new Date(o.timestamp);
			})
		}
		if (push.duplicates && push.duplicates.length) {
			push.duplicates.forEach(function (o) {
				if (o._id) o._id = new ObjectID(o._id);
				if (o.createdAt) o.createdAt = new Date(o.createdAt);
				if (o.originalTx) o.originalTx = new ObjectID(o.originalTx);
				if (o.clientResponse && o.clientResponse.timestamp) o.clientResponse.timestamp = new Date(o.clientResponse.timestamp);
			})
		}
	}

	// TODO: Hay que convertir a OID todos los campos necesarios, ya que se guardan como string en Sqlite
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
						if (!oldData['$push'][arrayName]['$each'] || !oldData['$push'][arrayName]['$each'].push) {
							oldData['$push'][arrayName] = {
								'$each': [oldData['$push'][arrayName]]
							};
						}
						if (newData['$push'][arrayName]['$each'] && newData['$push'][arrayName]['$each'].forEach) {
							newData['$push'][arrayName]['$each'].forEach(function (element) {
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

