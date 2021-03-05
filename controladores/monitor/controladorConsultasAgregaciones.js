'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externas
const { EJSON } = require('bson');

// Interfaces
const iTokens = require('global/tokens');
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
const consultaAgregaciones = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Consulta de agregación']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let pipeline = req.body;

	L.xt(txId, ['Analizando agregación', pipeline]);

	try {
		pipeline = EJSON.deserialize(pipeline, { relaxed: false });
	} catch (errorDeserializadoEJSON) {
		L.xw(txId, ['Error en la deserialización de la consulta EJSON', errorDeserializadoEJSON])
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al interpretar la consulta');
		return;
	}

	L.xt(txId, ['Agregación analizada', pipeline]);


	try {
		let resultado = await iMongo.consultaTx.agregacion(pipeline);
		res.status(200).json(resultado);
	} catch (errorMongo) {
		L.xw(txId, ['Ocurrió un error al realizar la agregación en mongoDB', errorMongo])
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al realizar la agregación');
		return;
	}


}


module.exports = {
	consultaAgregaciones
}

