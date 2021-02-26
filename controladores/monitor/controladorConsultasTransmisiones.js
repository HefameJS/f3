'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


// PUT /consulta
/**
 * {
 * 		"filtro": {
 * 			"_id": { "$oid": "5EC290F44783DB681D4E5E04" }
 * 		},
 * 		"proyeccion": {"authenticatingUser": 1},
 *  	"orden": {},
 * 		"skip": 0,
 * 		"limite": 10
 * }
 * NOTA: El campo filtro espera un objeto EJSON
 */
const consultaTransmisiones = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let consulta = req.body;

	iMongo.consultaTx.consulta(txId, consulta, (errorMongo, resultado) => {
		if (errorMongo) {
			L.e(['Ocurrió un error al realizar la consulta a mongoDB', errorMongo])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al realizar la consulta');
			return;
		}
		res.status(200).json(resultado);
	});

}


module.exports = {
	consultaTransmisiones
}

