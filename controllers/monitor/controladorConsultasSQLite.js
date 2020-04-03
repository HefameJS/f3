'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Isqlite = require(BASE + 'interfaces/isqlite');

// GET /status/sqlite
const getEstadoSQLite = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la base de datos SQLite']);

	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	Isqlite.countTx(null, (err, numRows) => {

		if (err) {
			L.xe(txId, ['Ocurrió un error al consultar el estado de SQLite', err])
			return res.status(500).send({ ok: false, msg: err });
		}

		Isqlite.countTx(10, (err, pendingRows) => {

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