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
const consultaTransmisiones = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let consulta = req.body;

	L.xt(txId, ['Analizando consulta', consulta]);

	try {
		if (consulta.filtro) consulta.filtro = EJSON.deserialize(consulta.filtro, { relaxed: false })
	} catch (errorDeserializadoEJSON) {
		L.xw(txId, ['Error en la deserialización de la consulta EJSON', errorDeserializadoEJSON])
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al interpretar la consulta');
		return;
	}

	L.xt(txId, ['Consulta analizada', consulta]);

	try {
		let resultado = await iMongo.consultaTx.consulta(consulta);
		res.status(200).json(resultado);
	} catch (errorMongo) {
		L.e(['Ocurrió un error al realizar la consulta a mongoDB', errorMongo])
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al realizar la consulta');
		return;
	}

}


module.exports = {
	consultaTransmisiones
}

