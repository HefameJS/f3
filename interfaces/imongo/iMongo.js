'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const memCache = require('memory-cache');
const commitBuffer = new memCache.Cache();

// Interfaces
const MDB = require('./iMongoConexion');
const iSqlite = require(BASE + 'interfaces/isqlite');


/**
 * 
 * @param {*} query 
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
			if (filter._id.$in) filter._id.$in = filter._id.$in.map(id => new ObjectID(id))
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

	if (MDB.cliente()) {
		let cursor = MDB.colTx().find(filter);
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

/**
 * Intenta obtener un documento cualquiera de la base de datos de transmisiones
 * y si lo consigue, asume que la conexión está operativa.
 * @param {*} callback - Cuando termina la operacion, se llama con un booleano indicando si hubo exito o no
 */
const connectionStatus = (callback) => {
	if (MDB.cliente()) {
		MDB.colTx().findOne({}, { _id: 1 }, (err, res) => {
			if (err) {
				return callback(false);
			}
			return callback(true);
		});
	} else {
		return callback(false);
	}
}

/**
 * Busca la transmisión con el ID indicadi
 * @param {*} txId 
 * @param {*} id 
 * @param {*} callback 
 */
const findTxById = (txId, id, callback) => {
	if (MDB.cliente()) {
		try {
			id = new ObjectID(id);
		} catch (ex) {
			L.xe(txId, ['**** Error al buscar la transmisión por ID', id, ex]);
			callback(ex, null);
			return;
		}
		MDB.colTx().findOne({ _id: id }, callback);
	} else {
		L.xe(txId, ['**** Error al localizar la transmisión'], 'mongodb');
		callback({ error: "No conectado a MongoDB" }, null);
	}
};

const findTxByCrc = (txId, crc, cb) => {

	if (MDB.cliente()) {
		try {
			if (crc.crc) crc = new ObjectID(crc.crc);
			else crc = new ObjectID(crc);

			MDB.colTx().findOne({ crc: crc }, cb);

		} catch (ex) {
			L.xe(txId, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC', ex], 'crc');
			cb(ex, null);
			return;
		}

	} else {
		L.xe(txId, ['**** ERROR AL BUSCAR LA TRANSACCION POR CRC, NO ESTA CONECTADO A MONGO'], 'crc');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};

/**
 * Busca la transmisión con el CRC dado
 * @param {*} crc 
 * @param {*} cb 
 */
const findCrcDuplicado = (crc, cb) => {

	if (MDB.cliente()) {
		try {
			crc = new ObjectID(crc);
			MDB.colTx().findOne({ crc: crc }, { _id: 1, crc: 1 }, cb);
		} catch (ex) {
			cb(ex, null);
			return;
		}

	} else {
		cb({ error: "No conectado a MongoDB" }, null);
	}
};

/**
 * 
 * @param {*} txId 
 * @param {*} numeroDevolucion 
 * @param {*} cb 
 */
const findTxByNumeroDevolucion = (txId, numeroDevolucion, cb) => {
	if (MDB.cliente()) {
		L.xd(txId, ['Consulta MDB', { type: K.TX_TYPES.DEVOLUCION, numerosDevolucion: numeroDevolucion }], 'mongodb');
		MDB.colTx().findOne({ type: K.TX_TYPES.DEVOLUCION, numerosDevolucion: numeroDevolucion }, cb);
	} else {
		L.xe(txId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};

const findTxByNumeroPedido = (txId, numeroPedido, cb) => {
	if (MDB.cliente()) {
		L.xd(txId, ['Consulta MDB', { type: K.TX_TYPES.PEDIDO, numerosPedido: numeroPedido }], 'mongodb');
		MDB.colTx().findOne({ type: K.TX_TYPES.PEDIDO, numerosPedido: numeroPedido }, cb);
	} else {
		L.xe(txId, ['**** Error al localizar la transmisión'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
};

const findConfirmacionPedidoByCRC = (crc, cb) => {
	if (MDB.cliente()) {
		crc = crc.substr(0, 8).toUpperCase();
		MDB.colTx().findOne({ type: K.TX_TYPES.CONFIRMACION_PEDIDO, "clientRequest.body.crc": crc }, cb);
	} else {
		cb({ error: "No conectado a MongoDB" }, null);
	}
};

/*	Obtiene las transmisiones que son candidatas de retransmitir */
const findCandidatosRetransmision = (limit, minimumAge, cb) => {
	if (MDB.cliente()) {
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
		MDB.colTx().find(query).limit(limit).toArray(cb);
	} else {
		L.e(['**** Error al buscar candidatos a retransmitir. No está conectado a mongodb'], 'mongodb');
		cb({ error: "No conectado a MongoDB" }, null);
	}
}


const commitDiscard = (data) => {

	var key = data['$setOnInsert']._id;


	if (MDB.cliente()) {
		MDB.colDiscard().updateOne({ _id: key }, data, { upsert: true, w: 0 }, function (err, res) {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT DISCARD. SE IGNORA LA TRANSMISION', err], 'mdbCommitDiscard');
			} else {
				//L.xd(key, ['COMMIT DISCARD OK'], 'mdbCommitDiscard');
			}
		});
	}
	else {
		L.xf(key, ['ERROR AL HACER COMMIT DISCARD'], 'mdbCommitDiscard');
	}

};

const commit = (data, noMerge) => {

	var key = data['$setOnInsert']._id;

	var cachedData = commitBuffer.get(key);
	if (cachedData && !noMerge) {
		data = mergeDataWithCache(cachedData, data);
	}


	if (MDB.cliente()) {
		MDB.colTx().updateOne({ _id: key }, data, { upsert: true }, (err, res) => {
			if (err) {
				L.xe(key, ['**** ERROR AL HACER COMMIT', err], 'mdbCommit');
				iSqlite.storeTx(data);
			}
		});
	}
	else {
		L.xf(key, ['ERROR AL HACER COMMIT', data], 'mdbCommit');
		iSqlite.storeTx(data);
	}

	if (cachedData) {
		commitBuffer.del(key);
	}

};

const buffer = (data) => {

	var key = data['$setOnInsert']._id;

	var cachedData = commitBuffer.get(key);
	var mergedData = mergeDataWithCache(cachedData, data);
	commitBuffer.put(key, mergedData, 5000, function /*onTimeout*/(key, value) {
		L.xw(key, ['Atención: Se fuerza COMMIT por timeout'], 'mdbCommit');
		module.exports.commit(value, false);
	});

}

const updateFromSqlite = (data, cb) => {

	convertToOidsAndDates(data);
	var key = data['$setOnInsert']._id;

	if (!data.$set) data.$set = {};

	data.$set['flags.' + K.FLAGS.SQLITE] = true;


	if (MDB.cliente()) {
		MDB.colTx().updateOne({ _id: key }, data, { upsert: true }, function (err, res) {
			if (err) {
				L.xe(key, ['** Error al actualizar desde SQLite', err], 'txSqliteCommit');
				mongoConnect();
				cb(false);
			} else {
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
	// Acceso a propiedades de la conexión en crudo
	ObjectID: MDB.ObjectID,
	cliente: MDB.cliente,
	db: MDB.db,
	colTx: MDB.colTx,
	colDiscard: MDB.colDiscard,
	colControl: MDB.colControl,


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
	consultaTX,

	monitor: require(BASE + 'interfaces/imongo/iMongoMonitoring')

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


