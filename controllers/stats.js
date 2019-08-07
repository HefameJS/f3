'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const credentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');


module.exports.getStats = function (req, res) {
	var item = req.params.item || req.query.item;
	if (!item) {
		res.status(400).send({ok: false,	msg: 'Debe especificar un elemento'});
		return;
	}

	if(req.params.item === 'fedicomCredentialsCache') {
		res.status(200).json(credentialsCache.stats());
	}
	else if(req.params.item === 'mdbStatus') {
		res.status(200).json(getMongoConnectionStatus());
	}
	else {
		res.status(404).json({ok: false, msg: 'Elemento no encontrado'});
	}

}


function getMongoConnectionStatus() {
	var Imongo = require(BASE + 'interfaces/imongo');
	return {ok: true, data: Imongo.connectionStatus()};

}