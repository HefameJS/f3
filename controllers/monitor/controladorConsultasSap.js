'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iSap = require('interfaces/isap/iSap');

// GET /status/sap
const consultaSap = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la comunicación con SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = (req.query ? req.query.sapSystem : null) || C.sap_systems.default;

	iSap.ping(nombreSistemaSap, (errorSap, estaConectado, sistemaSap) => {
		if (!errorSap) {
			res.status(200).json({ ok: true, data: { available: estaConectado, info: { baseUrl: sistemaSap.preCalculatedBaseUrl, name: nombreSistemaSap } } });
		} else {
			res.status(200).json({ ok: true, data: { available: estaConectado, error: errorSap } });
		}
	});
}

module.exports = {
	consultaSap
}