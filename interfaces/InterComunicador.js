'use strict';
const L = global.L;
const K = global.K;
const M = global.M;

// Externas
const axios = require('axios');

class InterComunicador {
	#transmision;						// Referencia a la transmisión que origina el intercambio con SAP
	log;								// Referencia a this.#transmision.log;

	constructor(transmision) {
		this.#transmision = transmision;
		this.log = this.#transmision.log;
	}

	async llamadaMonitorRemoto(destino, ruta, opciones) {

		let parametros = opciones || {};

		parametros.url = 'http://' + destino + ':5000' + ruta;
		parametros.responseType = 'json';
		parametros.headers = {
			...(opciones?.headers || {}),
			Authorization: 'Bearer ' + this.#transmision.token.getJwt(),
		}
		this.log.debug('Llamada por intercomunicador', parametros);
		let respuesta = await axios(parametros);
		return respuesta.data;

	}

}

module.exports = InterComunicador;

/*
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

	let monitores = await M.col.instancias
		.find({ 'procesos.tipo': K.PROCESOS.TIPOS.MONITOR })
		.project({ _id: 1 })
		.toArray();
	monitores = monitores.map(monitor => monitor._id);

	return await module.exports.llamadaMonitorMultiple(monitores, ruta, opciones)

}
*/