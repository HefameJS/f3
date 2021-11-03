'use strict';
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

	async llamadaMonitorMultiple(destinos, ruta, opciones) {

		this.log.debug(`Se procede a realizar la llamada '${ruta}' a multiples destinos`, destinos);

		if (!destinos || destinos.length === 0) {
			this.log.err('No está permitido llamar a _llamadaAMultiplesDestinos() sin especificar ningún destino !');
			throw new Error('No se ha especificado ningún destino');
		}

		let promesas = destinos.map(destino => this.llamadaMonitorRemoto(destino, ruta, opciones));
		let respuestas = await Promise.allSettled(promesas);

		let resultado = {};
		destinos.forEach(( destino, i) => {
			resultado[destino] = {
				ok: respuestas[i].status === "fulfilled",
				respuesta: respuestas[i].value ?? respuestas[i].reason?.message
			}
		})

		return resultado;

	}

	async llamadaTodosMonitores (ruta, opciones) {
		let monitores = await M.col.instancias
			.find({})
			.project({ _id: 1 })
			.toArray();
		monitores = monitores.map(monitor => monitor._id);
		return await this.llamadaMonitorMultiple(monitores, ruta, opciones)
	}

}

module.exports = InterComunicador;
