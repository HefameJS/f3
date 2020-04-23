'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iSQLite = require('interfaces/isqlite/iSQLite');

// GET /status/sqlite
const getEstadoSQLite = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la base de datos SQLite']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	iSQLite.contarEntradas(null, (err, numRows) => {

		if (err) {
			L.xe(txId, ['Ocurrió un error al consultar el estado de SQLite', err])
			return res.status(500).send({ ok: false, msg: err });
		}

		iSQLite.contarEntradas(C.watchdog.sqlite.maxRetries || 10, (err, pendingRows) => {

			if (err) {
				L.xe(txId, ['Ocurrió un error al consultar el estado de SQLite', err])
				return res.status(500).send({ ok: false, msg: err });
			}

			res.status(200).json({
				ok: true,
				data: {
					registrosTotales: numRows,
					registrosActivos: pendingRows
				}
			});
		});

	});

}

module.exports = {
	getEstadoSQLite
}