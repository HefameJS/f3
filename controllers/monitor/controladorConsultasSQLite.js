'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iSQLite = require('interfaces/isqlite/iSQLite');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');


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
const consultaRegistros = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de registros de SQLite']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let opcionesConsulta = req.body || {};

	iSQLite.consultaRegistros(opcionesConsulta, (errorSQLite, registros) => {

		if (errorSQLite) {
			L.xe(txId, ['Ocurrió un error al consultar los registros de SQLite', errorSQLite])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al consultar los registros de SQLite');
			return;
		}

		res.status(200).json(registros);

	});

}

// GET /sqlite/recuento
const recuentoRegistros = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del recuento de entradas de la base de datos SQLite']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iSQLite.recuentoRegistros((errorSQLite, recuento) => {

		if (errorSQLite) {
			L.xe(txId, ['Ocurrió un error al consultar el estado de SQLite', errorSQLite])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al consultar el estado de SQLite');
		}

		res.status(200).json(recuento);

	});

}




module.exports = {
	consultaRegistros,
	recuentoRegistros
}