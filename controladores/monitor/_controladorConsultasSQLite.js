'use strict';
//const C = global.C;
const L = global.L;
//const K = global.K;

// Interfaces
const iTokens = require('global/tokens');
const iMonitor = require('interfaces/_iMonitor');
const SQLite = require('global/sqlite');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


// PUT /sqlite
/**
 * {
 * 		where: {
 *			sql: 'WHERE retryCount >= ? AND txid = ?',
 * 			valores: [10, "5eb3bd86acfc103c8ca8b1ed"]
 * 		},
 * 		orderby: 'ORDER BY retryCount DESC',
 * 		limit: 50,
 * 		offset: 150
 * }
 */
const consultaRegistros = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de registros de SQLite']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let opcionesConsulta = req.body || {};

	if (req.query.servidor === 'local') {
		try {
			let registros = await SQLite.consultaRegistros(opcionesConsulta)
			res.status(200).json(registros);
		} catch (errorSQLite) {
			L.xe(txId, ['Ocurrió un error al consultar los registros de SQLite', errorSQLite])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al consultar los registros de SQLite');
			return;
		}
	} else {
		try {
			let respuestasRemotas = await iMonitor.llamadaTodosMonitores('/v1/sqlite?servidor=local', { method: 'PUT', body: req.body });
			res.status(200).send(respuestasRemotas);
		} catch (errorLlamada) {
			L.xe(txId, ['Ocurrió un error al obtener el recuento de registros SQLite', errorLlamada]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el recuento de registros SQLite');
			return;
		}

	}

}

// GET /sqlite/recuento
const recuentoRegistros = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta del recuento de entradas de la base de datos SQLite']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	if (req.query.servidor === 'local') {
		try {
			let recuento = await SQLite.recuentoRegistros();
			let resultado = {};
			recuento.forEach(elemento => {
				resultado[elemento.estado] = elemento.cantidad;
			});

			res.status(200).json(resultado);
		} catch (errorSQLite) {
			L.xe(txId, ['Ocurrió un error al obtener el recuento de registros SQLite', errorSQLite])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el recuento de registros SQLite');
		}
	} else {
		try {
			let recuento = await iMonitor.llamadaTodosMonitores('/v1/sqlite/recuento?servidor=local');

			res.status(200).json(recuento);
		} catch (errorLlamada) {
			L.xe(txId, ['Ocurrió un error al obtener el recuento de registros SQLite', errorLlamada])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el recuento de registros SQLite');
		}
	}

}




module.exports = {
	consultaRegistros,
	recuentoRegistros
}