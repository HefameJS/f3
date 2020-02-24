'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

//const Tokens = require(BASE + 'util/tokens');
const Imongo = require(BASE + 'interfaces/imongo');
const ReplicaSetStatus = require(BASE + 'model/monitor/replicaSetStatus')


const getNombresColecciones = (req, res) => {
	Imongo.monitor.getNombresColecciones( (err, colecciones) => {
		if (err) {
			L.e(['Error al obtener la lista de colecciones', err]);
			res.status(500).send({ ok: false, error: err });
		} else {
			res.status(200).send({ ok: true, data: colecciones });	
		}
	})
}

const getColeccion = function (req, res) {

	if (!req.params.colName) {
		return res.status(400).json({ ok: false, error: 'Debe especificar el nombre de la colección' });
	}

	var fullData = (req.query.full === 'true');

	Imongo.monitor.getColeccion(req.params.colName, (err, collStats) => {
		if (err) {
			L.e(['Error al obtener los datos de la colección', err]);
			return res.status(500).json({ ok: false, error: 'Error al obtener los datos de la colección' });
		}

		if (!fullData) {
			if (collStats.wiredTiger) delete collStats.wiredTiger;
			if (collStats.indexDetails) delete collStats.indexDetails;
		}

		delete collStats['$clusterTime'];
		delete collStats.ok;
		delete collStats.operationTime;

		return res.status(200).json({ ok: true, data: collStats });

	});
}

const getDatabase = function (req, res) {
	Imongo.monitor.getDatabase((err, dbStats) => {
		if (err) {
			L.e(['Error al obtener estadísticas de la base de datos', err]);
			return res.status(500).json({ ok: false, error: 'Error al obtener estadísticas de la base de datos' });
		}

		delete dbStats['$clusterTime'];
		delete dbStats.ok;
		delete dbStats.operationTime;

		return res.status(200).json({ ok: true, data: dbStats });

	});
}

const getOperaciones = function (req, res) {
	Imongo.monitor.getOperaciones((err, sessions) => {
		if (err) {
			L.e(['Error al obtener la lista de operaciones', err]);
			return res.status(500).json({ ok: false, msg: 'Error al obtener la lista de operaciones' });
		}

		return res.status(200).json({ ok: true, data: sessions });
 
	});
}

const getReplicaSet = function (req, res) {

	Imongo.monitor.getReplicaSet((err, data) => {
		if (err) {
			L.e(['Error al obtener el estado del cluster', err]);
			return res.status(500).json({ ok: false, msg: 'Error al obtener el estado del cluster' });
		}

		var rsStatus = new ReplicaSetStatus(data);
		L.i(['Estado de mongodb', rsStatus]);
		return res.status(200).json({ ok: true, data: rsStatus });

	});
}

const getLogs = function (req, res) {

	var logType = req.query.type ? req.query.type : 'global';

	Imongo.monitor.getLogs(logType, (err, logs) => {
		if (err) {
			L.e(['Error al obtener los logs', err]);
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