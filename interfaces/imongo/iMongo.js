'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Interfaces
// const conexionMongo = require('./iMongoConexion');


/**
 * Intenta obtener un documento cualquiera de la base de datos de transmisiones
 * y si lo consigue, asume que la conexión está operativa.
 * @param {*} callback - Cuando termina la operacion, se llama con un booleano indicando si hubo exito o no
 */
const chequeaConexion = (callback) => {
	if (conexionMongo.colTx()) {
		conexionMongo.colTx().findOne({}, { _id: 1 }, (err, res) => {
			if (err) {
				return callback(false);
			}
			return callback(true);
		});
	} else {
		return callback(false);
	}
}



module.exports = {
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
	consultaTx: require('./iMongoConsultaTx'),
	transaccion: require('./iMongoTransaccion'),
	monitor: require('./iMongoMonitor')*/
}
