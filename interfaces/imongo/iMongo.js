'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
const M = global.mongodb;

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
	//conexion: conexionMongo
	/*
	conectar: MDB.conectar,
	// Acceso a propiedades de la conexión en crudo
	ObjectID: MDB.ObjectID,
	cliente: MDB.cliente,
	db: MDB.db,
	colTx: MDB.colTx,
	colDiscard: MDB.colDiscard,
	colControl: MDB.colControl,
	colConfiguracion: MDB.colConfiguracion,

	chequeaConexion,

	// Consultas sobre las transmisiones
	
	
	monitor: require('./iMongoMonitor')*/
}
