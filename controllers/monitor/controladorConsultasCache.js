'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const CredentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');

// GET /status/cache/credenciales
const getEstadoCacheCredenciales = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la caché de credenciales']);

	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	res.status(200).json(CredentialsCache.stats());

}

module.exports = {
	getEstadoCacheCredenciales
}