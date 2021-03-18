'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Externas
const axios = require('axios');

// Interfaces
const iTokens = require('global/tokens');

// 
const tokenIntermonitor = iTokens.generarTokenInterFedicom();



module.exports.llamadaMonitorRemoto = async function (destino, ruta, opciones) {

	let parametros = opciones || {};

	parametros.url = 'http://' + destino + ':5001' + ruta;
	parametros.responseType = 'json';
	parametros.headers = {
		...(opciones?.headers || {}),
		Authorization: 'Bearer ' + tokenIntermonitor,
	}

	try {
		let respuesta = await axios(parametros);
		return respuesta.data;
	} catch (error) {
		throw new Error(error.message);
	}

}


module.exports.llamadaMonitorMultiple = async function (destinos, ruta, opciones) {

	L.d(['Se procede a realizar la llamada a multiples destinos', destinos, ruta]);

	if (!destinos || destinos.length === 0) {
		L.e(['No está permitido llamar a _llamadaAMultiplesDestinos() sin especificar ningún destino !', destinos]);
		callback(new Error('No se ha especificado ningún destino'), null);
		return;
	}

	let promesas = destinos.map(destino => module.exports.llamadaMonitorRemoto(destino, ruta, opciones));
	let respuestas = await Promise.allSettled(promesas);

	let resultado = {};
	for (let i = 0; i < destinos.length; i++) {
		resultado[destinos[i]] = {
			ok: respuestas[i].status === "fulfilled",
			respuesta: respuestas[i].value ?? respuestas[i].reason?.message
		}
	}

	return resultado;

}


module.exports.llamadaTodosMonitores = async function (ruta, opciones) {

	let monitores = await M.db.collection('instancias')
		.find({ 'procesos.tipo': K.PROCESOS.TIPOS.MONITOR })
		.project({ _id: 1 })
		.toArray();
	monitores = monitores.map(monitor => monitor._id);

	return await module.exports.llamadaMonitorMultiple(monitores, ruta, opciones)

}
