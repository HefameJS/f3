'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');

// Modelos
const EstadoReplicaSet = require('model/monitor/ModeloEstadoReplicaSet')
const ErrorFedicom = require('model/ModeloErrorFedicom');

// GET /mongodb/colecciones
const getNombresColecciones = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getNombresColecciones((errorMongo, colecciones) => {
		if (errorMongo) {
			L.e(['Error al obtener la lista de colecciones', errorMongo]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de colecciones');
		} else {
			res.status(200).send(colecciones);
		}
	})
}

// GET /mongodb/colecciones/:colName ? [datosExtendidos=true]
const getColeccion = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	if (!req.params.colName) {
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Debe especificar el nombre de la colección', 400);
		return;
	}

	let consultarDatosExtendidos = (req.query.datosExtendidos === 'true');

	iMongo.monitor.getColeccion(req.params.colName, (errorMongo, datosColeccion) => {
		if (errorMongo) {
			L.e(['Error al obtener los datos de la colección', errorMongo]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener los datos de la colección');
			return;
		}

		if (!consultarDatosExtendidos) {
			if (datosColeccion.wiredTiger) delete datosColeccion.wiredTiger;
			if (datosColeccion.indexDetails) delete datosColeccion.indexDetails;
		}

		delete datosColeccion['$clusterTime'];
		delete datosColeccion.ok;
		delete datosColeccion.operationTime;

		return res.status(200).json(datosColeccion);

	});
}

// GET /mongodb/database
const getDatabase = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getDatabase((errorMongo, estadisticasDb) => {
		if (errorMongo) {
			L.e(['Error al obtener estadísticas de la base de datos', errorMongo]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener estadísticas de la base de datos');
			return;
		}

		delete estadisticasDb['$clusterTime'];
		delete estadisticasDb.ok;
		delete estadisticasDb.operationTime;

		return res.status(200).json(estadisticasDb);

	});
}

// GET /mongodb/operaciones
const getOperaciones = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getOperaciones((errorMongo, operaciones) => {
		if (errorMongo) {
			L.e(['Error al obtener la lista de operaciones', errorMongo]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de operaciones');
			return;
		}

		return res.status(200).json(operaciones);

	});
}

// GET /mongodb/replicaSet
const getReplicaSet = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getReplicaSet((errorMongo, datosReplicaSet) => {
		if (errorMongo) {
			L.e(['Error al obtener el estado del clúster', errorMongo]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener el estado del clúster');
			return;
		}

		let estadoReplicaSet = new EstadoReplicaSet(datosReplicaSet);
		return res.status(200).json( estadoReplicaSet );

	});
}

// GET /mongodb/logs ? [tipo=(global|rs|startupWarnings)]
const getLogs = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let tipoLog = req.query.tipo ? req.query.tipo : 'global';

	iMongo.monitor.getLogs(tipoLog, (errorMongo, logs) => {
		if (errorMongo) {
			L.e(['Error al obtener los logs', errorMongo]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener los logs');
			return;
		}

		delete logs['$clusterTime'];
		delete logs.ok;
		delete logs.operationTime;

		return res.status(200).json(logs);

	});
}

module.exports = {
	getNombresColecciones,
	getColeccion,
	getDatabase,
	getOperaciones,
	getReplicaSet,
	getLogs
}