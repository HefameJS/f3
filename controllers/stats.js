'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const credentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');
const Isqlite = require(BASE + 'interfaces/isqlite');
const Imongo = require(BASE + 'interfaces/imongo');
const Isap = require(BASE + 'interfaces/isap');

module.exports.getStats = function (req, res) {
	var item = req.params.item || req.query.item;
	if (!item) {
		res.status(400).send({ok: false,	msg: 'Debe especificar un elemento'});
		return;
	}


	if(req.params.item === 'fedicomCredentialsCache') {
		res.status(200).json(credentialsCache.stats());
	}
	else {
		res.status(404).json({ok: false, msg: 'Elemento no encontrado'});
	}

}

