'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');

// Modelos
const EstadoReplicaSet = require('model/monitor/ModeloEstadoReplicaSet')

// GET /status/mdb/col
const getNombresColecciones = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getNombresColecciones((err, colecciones) => {
		if (err) {
			L.e(['Error al obtener la lista de colecciones', err]);
			res.status(500).send({ ok: false, error: err });
		} else {
			res.status(200).send({ ok: true, data: colecciones });
		}
	})
}

// GET /status/mdb/col/:colName
const getColeccion = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	if (!req.params.colName) {
		return res.status(400).json({ ok: false, error: 'Debe especificar el nombre de la colección' });
	}

	let consultarDatosExtendidos = (req.query.full === 'true');

	iMongo.monitor.getColeccion(req.params.colName, (errorMongo, datosColeccion) => {
		if (errorMongo) {
			L.e(['Error al obtener los datos de la colección', errorMongo]);
			return res.status(500).json({ ok: false, error: 'Error al obtener los datos de la colección' });
		}

		if (!consultarDatosExtendidos) {
			if (datosColeccion.wiredTiger) delete datosColeccion.wiredTiger;
			if (datosColeccion.indexDetails) delete datosColeccion.indexDetails;
		}

		delete datosColeccion['$clusterTime'];
		delete datosColeccion.ok;
		delete datosColeccion.operationTime;

		return res.status(200).json({ ok: true, data: datosColeccion });

	});
}

// GET /status/mdb/db
const getDatabase = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getDatabase((errorMongo, estadisticasDb) => {
		if (errorMongo) {
			L.e(['Error al obtener estadísticas de la base de datos', errorMongo]);
			return res.status(500).json({ ok: false, error: 'Error al obtener estadísticas de la base de datos' });
		}

		delete estadisticasDb['$clusterTime'];
		delete estadisticasDb.ok;
		delete estadisticasDb.operationTime;

		return res.status(200).json({ ok: true, data: estadisticasDb });

	});
}

// GET /status/mdb/op
const getOperaciones = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getOperaciones((errorMongo, sesiones) => {
		if (errorMongo) {
			L.e(['Error al obtener la lista de operaciones', errorMongo]);
			return res.status(500).json({ ok: false, msg: 'Error al obtener la lista de operaciones' });
		}

		return res.status(200).json({ ok: true, data: sesiones });

	});
}

// GET /status/mdb/rs
const getReplicaSet = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iMongo.monitor.getReplicaSet((errorMongo, datosReplicaSet) => {
		if (errorMongo) {
			L.e(['Error al obtener el estado del cluster', errorMongo]);
			return res.status(500).json({ ok: false, msg: 'Error al obtener el estado del cluster' });
		}

		let estadoReplicaSet = new EstadoReplicaSet(datosReplicaSet);
		L.i(['Estado de mongodb', estadoReplicaSet]);
		return res.status(200).json({ ok: true, data: estadoReplicaSet });

	});
}

// GET /status/mdb/log [?type=(global|rs|startupWarnings)]
const getLogs = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let tipoLog = req.query.type ? req.query.type : 'global';

	iMongo.monitor.getLogs(tipoLog, (errorMongo, logs) => {
		if (errorMongo) {
			L.e(['Error al obtener los logs', errorMongo]);
			return res.status(500).json({ ok: false, error: 'Error al obtener los logs' });
		}

		return res.status(200).json({ ok: true, data: logs });

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