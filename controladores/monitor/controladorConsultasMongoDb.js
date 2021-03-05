'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('global/tokens');
const iMongo = require('interfaces/imongo/iMongo');

// Modelos
const EstadoReplicaSet = require('modelos/monitor/ModeloEstadoReplicaSet')
const ErrorFedicom = require('modelos/ErrorFedicom');

// GET /mongodb/colecciones
const getNombresColecciones = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de LISTA DE COLECCIONES de Mongodb']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	try {
		let colecciones = await iMongo.monitorMongo.getNombresColecciones();
		res.status(200).send(colecciones);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener la lista de colecciones', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de colecciones');
	}
}

// GET /mongodb/colecciones/:colName ? [datosExtendidos=true]
const getColeccion = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de COLECCION de Mongodb']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	if (!req.params.colName) {
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Debe especificar el nombre de la colección', 400);
		return;
	}

	let consultarDatosExtendidos = (req.query.datosExtendidos === 'true');

	try {
		let datosColeccion = await iMongo.monitorMongo.getColeccion(req.params.colName);

		if (!consultarDatosExtendidos) {
			if (datosColeccion.wiredTiger) delete datosColeccion.wiredTiger;
			if (datosColeccion.indexDetails) delete datosColeccion.indexDetails;
		}

		delete datosColeccion['$clusterTime'];
		delete datosColeccion.ok;
		delete datosColeccion.operationTime;

		res.status(200).json(datosColeccion);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener los datos de la colección', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener los datos de la colección');
	}

}

// GET /mongodb/database
const getDatabase = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de DATABASE de Mongodb']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	try {
		let estadisticasDb = await iMongo.monitorMongo.getDatabase();
		delete estadisticasDb['$clusterTime'];
		delete estadisticasDb.ok;
		delete estadisticasDb.operationTime;
		res.status(200).json(estadisticasDb);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener estadísticas de la base de datos', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener estadísticas de la base de datos');
	}

}

// GET /mongodb/operaciones
const getOperaciones = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de OPERACIONES de Mongodb']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	try {
		let operaciones = await iMongo.monitorMongo.getOperaciones();
		res.status(200).json(operaciones);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener la lista de operaciones', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de operaciones');
	}

}

// GET /mongodb/replicaSet
const getReplicaSet = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de REPLICA SET de Mongodb']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	try {
		let datosReplicaSet = await iMongo.monitorMongo.getReplicaSet();
		let estadoReplicaSet = new EstadoReplicaSet(datosReplicaSet);
		return res.status(200).json(estadoReplicaSet);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener el estado del clúster', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener el estado del clúster');
	}
}

// GET /mongodb/logs ? [tipo=(global|rs|startupWarnings)]
const getLogs = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de LOGS de Mongodb']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let tipoLog = req.query.tipo ? req.query.tipo : 'global';

	try {
		let logs = await iMongo.monitorMongo.getLogs(tipoLog);
		delete logs['$clusterTime'];
		delete logs.ok;
		delete logs.operationTime;
		return res.status(200).json(logs);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener los logs', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener los logs');
		return;
	}
}

module.exports = {
	getNombresColecciones,
	getColeccion,
	getDatabase,
	getOperaciones,
	getReplicaSet,
	getLogs
}