'use strict';
//const C = global.C;
//const L = global.L;
//const K = global.K;
const M = global.M;

// Interfaces
// const conexionMongo = require('./iMongoConexion');


/**
 * Intenta obtener un documento cualquiera de la base de datos de transmisiones
 * y si lo consigue, asume que la conexión está operativa.
 * @param {*} callback - Cuando termina la operacion, se llama con un booleano indicando si hubo exito o no
 */
const chequeaConexion = function () {

	return new Promise(async function(resolve) {
		if (M.col.tx) {
			try {
				await M.col.tx.findOne({}, { _id: 1 });
				resolve(true);
			}
			catch (error) {
				resolve(false);
			}
		} else {
			resolve(false);
		}
	});
}



module.exports = {
	chequeaConexion,
	transaccion: require('./iMongoTransaccion'),
	consultaTx: require('./iMongoConsultaTx'),
	monitorMongo: require('./iMongoMonitor')
}
