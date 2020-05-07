'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iSQLite = require('interfaces/isqlite/iSQLite');



// PUT /sqlite
const consultaRegistros = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de registros de SQLite']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let opcionesConsulta = req.body || {};

	iSQLite.consultaRegistros(opcionesConsulta, (errorSQLite, registros) => {

		if (errorSQLite) {
			L.xe(txId, ['Ocurrió un error al consultar los registros de SQLite', errorSQLite])
			return res.status(500).send({ ok: false, msg: errorSQLite });
		}

		res.status(200).json({
			ok: true,
			data: registros
		});

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
			return res.status(500).send({ ok: false, msg: errorSQLite });
		}

		res.status(200).json({
			ok: true,
			data: recuento
		});

	});

}




module.exports = {
	consultaRegistros,
	recuentoRegistros
}