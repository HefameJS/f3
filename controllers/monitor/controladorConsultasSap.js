'use strict';
//const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Isap = require(BASE + 'interfaces/isap')

// GET /status/sap
const consultaSap = function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la comunicación con SAP']);

	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let sapSysName = req.query.sapSystem || C.sap_systems.default;

	Isap.ping(sapSysName, (err, status, sapSystem) => {
		if (!err) {
			res.status(200).json({ ok: true, data: { available: status, info: { baseUrl: sapSystem.preCalculatedBaseUrl, name: sapSysName } } });
		} else {
			res.status(200).json({ ok: true, data: { available: status, error: err } });
		}
	});
}

module.exports = {
	consultaSap
}