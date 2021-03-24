'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;
const M = global.mongodb;

// Externo
const MemoryCache = require('memory-cache');

// Interfaces
const iSQLite = require('interfaces/iSQLite');


const cacheTransacciones = new MemoryCache.Cache();

const descartar = async function (transaccion) {
	let txId = transaccion['$setOnInsert']._id;

	try {
		await M.col.descartes.updateOne({ _id: txId }, transaccion, { upsert: true });
		L.xd(txId, ['Commit Descarte OK'], 'mdbCommitDescarte');
		return true;
	} catch (errorMongo) {
		L.xe(txId, ['Error al hacer COMMIT Descarte', errorMongo], 'mdbCommitDescarte');
	}

	return false;
}

const grabar = async function (transaccion, noAgregarConCache) {

	let txId = transaccion['$setOnInsert']._id;

	let transaccionEnCache = cacheTransacciones.get(txId);
	if (transaccionEnCache && !noAgregarConCache) {
		cacheTransacciones.del(txId);
		transaccion = _unirConDatosDeCache(transaccionEnCache, transaccion);
	}

	try {
		await M.col.tx.updateOne({ _id: txId }, transaccion, { upsert: true });
		L.xd(txId, ['Commit OK'], 'mdbCommit');
		return true;
	} catch (errorMongo) {
		L.xe(txId, ['Error al hacer COMMIT', errorMongo], 'mdbCommit');
		iSQLite.grabarTransaccion(transaccion);
		return false;
	}

};

const grabarEnMemoria = async function (transaccion) {

	let txId = transaccion['$setOnInsert']._id;
	let transaccionEnCache = cacheTransacciones.get(txId);
	let nuevaTransaccion = _unirConDatosDeCache(transaccionEnCache, transaccion);
	cacheTransacciones.put(txId, nuevaTransaccion, 10000, (key, value) => {
		L.xw(key, ['Se fuerza COMMIT por timeout'], 'mdbCommit');
		grabar(value);
	});
	return true;

}



const grabarDesdeSQLite = async function (transaccion) {

	let txId = transaccion['$setOnInsert']._id;

	// Establecemos la bandera SQLite en la transaccion.
	if (!transaccion.$set) transaccion.$set = {};
	transaccion.$set['flags.' + C.flags.SQLITE] = true;

	try {
		await M.col.tx.updateOne({ _id: txId }, transaccion, { upsert: true })
		return true;
	} catch (errorMongo) {
		L.xe(txId, ['Error al grabar en MongoDB desde SQLite', errorMongo], 'txSqliteCommit');
		return false;
	}

}


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
							datosNuevos['$push'][nombreDeArray]['$each'].forEach(elemento => {
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


