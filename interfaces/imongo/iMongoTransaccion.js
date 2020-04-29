'use strict';
//const C = global.config;
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


