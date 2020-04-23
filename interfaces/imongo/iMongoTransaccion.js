'use strict';
////const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const MemoryCache = require('memory-cache');
const ObjectID = require('mongodb').ObjectID;

// Interfaces
const MDB = require('./iMongoConexion');
const iSQLite = require('interfaces/isqlite/iSQLite');


const cacheTransacciones = new MemoryCache.Cache();

const descartar = (transaccion) => {

	let txId = transaccion['$setOnInsert']._id;


	if (MDB.colDiscard()) {
		MDB.colDiscard().updateOne({ _id: txId }, transaccion, { upsert: true, w: 0 }, (errorMongo, res) => {
			if (errorMongo) {
				L.xe(txId, ['**** ERROR AL HACER COMMIT DISCARD. SE IGNORA LA TRANSMISION', errorMongo], 'mdbCommitDiscard');
			} else {
				//L.xd(key, ['COMMIT DISCARD OK'], 'mdbCommitDiscard');
			}
		});
	}
	else {
		L.xf(txId, ['ERROR AL HACER COMMIT DISCARD'], 'mdbCommitDiscard');
	}

};

const grabar = (transaccion, noAgregarConCache) => {

	let txId = transaccion['$setOnInsert']._id;

	let transaccionEnCache = cacheTransacciones.get(txId);
	if (transaccionEnCache && !noAgregarConCache) {
		transaccion = _unirConDatosDeCache(transaccionEnCache, transaccion);
	}

	if (MDB.colTx()) {
		MDB.colTx().updateOne({ _id: txId }, transaccion, { upsert: true }, (errorMongo, res) => {
			if (errorMongo) {
				L.xe(txId, ['**** ERROR AL HACER COMMIT', errorMongo], 'mdbCommit');
				iSQLite.grabarTransaccion(transaccion);
			}
		});
	}
	else {
		L.xf(txId, ['ERROR AL HACER COMMIT', transaccion], 'mdbCommit');
		iSQLite.grabarTransaccion(transaccion);
	}

	if (transaccionEnCache) {
		cacheTransacciones.del(txId);
	}

};

const grabarEnMemoria = (transaccion) => {

	let txId = transaccion['$setOnInsert']._id;
	let transaccionEnCache = cacheTransacciones.get(txId);
	let nuevaTransaccion = _unirConDatosDeCache(transaccionEnCache, transaccion);
	cacheTransacciones.put(txId, nuevaTransaccion, 5000, /*onTimeout*/(key, value) => {
		L.xw(key, ['Atención: Se fuerza COMMIT por timeout'], 'mdbCommit');
		grabar(value);
	});

}

const grabarDesdeSQLite = (transaccion, callback) => {
	
	// Como estamos serializando mal en iSQLite.grabar() tenemos que hacer esta ñapa.
 	// TODO: https://docs.mongodb.com/v3.0/reference/mongodb-extended-json/ Para serializar correctamente objetos como ObjectIDs y Dates
	_transformarDatosSQLiteParaMDB(transaccion);

	let txId = transaccion['$setOnInsert']._id;

	// Establecemos la bandera SQLite en la transaccion.
	if (!transaccion.$set) transaccion.$set = {};
	transaccion.$set['flags.' + K.FLAGS.SQLITE] = true;


	if (MDB.colTx()) {
		MDB.colTx().updateOne({ _id: txId }, transaccion, { upsert: true }, (err, resultado) => {
			if (err) {
				L.xe(txId, ['** Error al actualizar desde SQLite', err], 'txSqliteCommit');
				callback(false);
			} else {
				callback(true);
			}
		});
	}
	else {
		L.xe(txId, ['** No conectado a MongoDB'], 'txSqliteCommit');
		callback(false);
	}

};


module.exports = {
	descartar,
	grabar,
	grabarEnMemoria,
	grabarDesdeSQLite,
}




/**
 * Como estamos serializando mal en iSQLite.grabar() tenemos que hacer esta ñapa.
 * TODO: https://docs.mongodb.com/v3.0/reference/mongodb-extended-json/ Para serializar correctamente objetos como ObjectIDs y Dates
 * @param {*} transaccion 
 */
const _transformarDatosSQLiteParaMDB = (transaccion) => {
	if (transaccion['$setOnInsert']) {
		let txSetOnInsert = transaccion['$setOnInsert'];
		if (txSetOnInsert._id) txSetOnInsert._id = new ObjectID(txSetOnInsert._id);
		if (txSetOnInsert.originalTx) txSetOnInsert.originalTx = new ObjectID(txSetOnInsert.originalTx);
		if (txSetOnInsert.confirmingId) txSetOnInsert.originalTx = new ObjectID(txSetOnInsert.originalTx);
		if (txSetOnInsert.createdAt) txSetOnInsert.createdAt = new Date(txSetOnInsert.createdAt);
	}

	if (transaccion['$max']) {
		let txMax = transaccion['$max'];
		if (txMax.modifiedAt) txMax.modifiedAt = new Date(txMax.modifiedAt);
	}

	if (transaccion['$set']) {
		let txSet = transaccion['$set'];
		if (txSet.crc) txSet.crc = new ObjectID(txSet.crc);
		if (txSet.sapRequest && txSet.sapRequest.timestamp) txSet.sapRequest.timestamp = new Date(txSet.sapRequest.timestamp);
		if (txSet.sapResponse && txSet.sapResponse.timestamp) txSet.sapResponse.timestamp = new Date(txSet.sapResponse.timestamp);
		if (txSet.clientResponse && txSet.clientResponse.timestamp) txSet.clientResponse.timestamp = new Date(txSet.clientResponse.timestamp);
	}

	if (transaccion['$push']) {
		let txPush = transaccion['$push'];
		if (txPush.retransmissions && txPush.retransmissions.length) {
			txPush.retransmissions.forEach((o) => {
				if (o._id) o._id = new ObjectID(o._id);
				if (o.createdAt) o.createdAt = new Date(o.createdAt);
				if (o.oldClientResponse && o.oldClientResponse.timestamp) o.oldClientResponse.timestamp = new Date(o.oldClientResponse.timestamp);
			})
		}
		if (txPush.sapConfirms && txPush.sapConfirms.length) {
			txPush.sapConfirms.forEach((o) => {
				if (o.txId) o.txId = new ObjectID(o.txId);
				if (o.timestamp) o.timestamp = new Date(o.timestamp);
			})
		}
		if (txPush.duplicates && txPush.duplicates.length) {
			txPush.duplicates.forEach((o) => {
				if (o._id) o._id = new ObjectID(o._id);
				if (o.createdAt) o.createdAt = new Date(o.createdAt);
				if (o.originalTx) o.originalTx = new ObjectID(o.originalTx);
				if (o.clientResponse && o.clientResponse.timestamp) o.clientResponse.timestamp = new Date(o.clientResponse.timestamp);
			})
		}
	}

	return transaccion;
}

/**
 * Une dos transacciones en una sola.
 * Si la nueva transaccion contiene propiedades ya existente en la previa, los nuevos prevalecen.
 * @param {*} datosPrevios 
 * @param {*} datosNuevos 
 */
const _unirConDatosDeCache = (datosPrevios, datosNuevos) => {
	if (datosPrevios) {
		if (datosNuevos['$setOnInsert']) {
			if (datosPrevios['$setOnInsert']) {
				for (let valor in datosNuevos['$setOnInsert']) {
					datosPrevios['$setOnInsert'][valor] = datosNuevos['$setOnInsert'][valor];
				}
			} else {
				datosPrevios['$setOnInsert'] = datosNuevos['$setOnInsert'];
			}

		}

		if (datosNuevos['$max']) {
			if (datosPrevios['$max']) {
				for (let valor in datosNuevos['$max']) {
					datosPrevios['$max'][valor] = datosNuevos['$max'][valor];
				}
			} else {
				datosPrevios['$max'] = datosNuevos['$max'];
			}
		}

		if (datosNuevos['$set']) {
			if (datosPrevios['$set']) {
				for (let valor in datosNuevos['$set']) {
					datosPrevios['$set'][valor] = datosNuevos['$set'][valor];
				}
			} else {
				datosPrevios['$set'] = datosNuevos['$set'];
			}
		}

		if (datosNuevos['$push']) {
			if (datosPrevios['$push']) {
				for (let nombreDeArray in datosNuevos['$push']) {
					if (datosPrevios['$push'][nombreDeArray]) {
						if (!datosPrevios['$push'][nombreDeArray]['$each'] || !datosPrevios['$push'][nombreDeArray]['$each'].push) {
							datosPrevios['$push'][nombreDeArray] = {
								'$each': [datosPrevios['$push'][nombreDeArray]]
							};
						}
						if (datosNuevos['$push'][nombreDeArray]['$each'] && datosNuevos['$push'][nombreDeArray]['$each'].forEach) {
							datosNuevos['$push'][nombreDeArray]['$each'].forEach( elemento => {
								datosPrevios['$push'][nombreDeArray]['$each'].push(elemento);
							});
						} else {
							datosPrevios['$push'][nombreDeArray]['$each'].push(datosNuevos['$push'][nombreDeArray]);
						}
					} else {
						datosPrevios['$push'][nombreDeArray] = datosNuevos['$push'][nombreDeArray];
					}
				}
			}
			else {
				datosPrevios['$push'] = datosNuevos['$push'];
			}
		}
		return datosPrevios;
	} else {
		return datosNuevos;
	}
}


