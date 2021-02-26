'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


// PUT /agregacion
/**
[
    {
        "$match": {
            "type": 10
        }
    }, {
        "$group": {
            "_id": "$status",
            "transmisiones": {
                "$sum": 1
            }
        }
    }
]
 * NOTA: El body se espera que sea un pipeline codificado en EJSON
 */
const consultaAgregaciones = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta de agregacion']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let pipeline = req.body;

	iMongo.consultaTx.agregacion(txId, pipeline, (errorMongo, resultado) => {
		if (errorMongo) {
			L.e(['Ocurrió un error al realizar la agregación en mongoDB', errorMongo])
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al realizar la agregación');
			return;
		}
		res.status(200).json(resultado);
	});

}


module.exports = {
	consultaAgregaciones
}

