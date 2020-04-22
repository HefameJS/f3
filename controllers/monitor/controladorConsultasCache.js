'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require(BASE + 'util/tokens');
const iCacheCredencialesSap = require(BASE + 'interfaces/isap/iCacheCredencialesSap');

// GET /status/cache/credenciales
const getEstadoCacheCredenciales = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la caché de credenciales']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	res.status(200).json(iCacheCredencialesSap.estadisticas());

}

module.exports = {
	getEstadoCacheCredenciales
}