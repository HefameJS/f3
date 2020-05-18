'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');


// PUT /consulta
const consultaTransmisiones = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let consulta = req.body;

	iMongo.consultaTx.consulta(txId, consulta, (errorMongo, resultado) => {
		if (errorMongo) {
			ErrorFedicom.generarYEnviarErrorMonitor(res, errorMongo.error || errorMongo.message);
			return;
		}
		res.status(200).json(resultado);
	});

}


module.exports = {
	consultaTransmisiones
}

