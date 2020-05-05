'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');


// PUT /consulta
const consultaTransmisiones = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let query = req.body;

	iMongo.consultaTx.consulta(txId, query, (errorMongo, resultado) => {
		if (errorMongo) {
			res.status(500).json({ ok: false, error: (errorMongo.error || errorMongo.message) });
			return;
		}
		res.status(200).json({ ok: true, ...resultado });
	});

}


module.exports = {
	consultaTransmisiones
}

