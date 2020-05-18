'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externas
const lock = require('locks');
const request = require('request');

// Interfaces
const iTokens = require('util/tokens');
const iProcesos = require('interfaces/procesos/iRegistroProcesos');




/**
 * Condensa en un solo objeto la respuesta dada por un monitor remoto.
 * La respuesta se completa adjuntando la propiedad body el cuerpo de la respuesta
 * y una propiedad que indica si hubo error en la respuesta (codigo respuesta HTTP distinto de 2xx)
 */
const _ampliaRespuestaMonitor = (repuestaMonitor, cuerpoMonitor) => {
	if (!repuestaMonitor) repuestaMonitor = {};
	repuestaMonitor.body = cuerpoMonitor;
	repuestaMonitor.error = Math.floor(repuestaMonitor.statusCode / 100) !== 2;
	return repuestaMonitor;
}


const realizarLlamadaInterna = (destino, ruta, callback) => {

	let parametrosLlamada = {
		followAllRedirects: true,
		uri: 'http://' + destino + ':5001' + ruta,
		headers: {
			Authorization: 'Bearer ' + iTokens.generarTokenInterFedicom()
		}
	}

	L.e(['Realizando llamada a monitor remoto', parametrosLlamada], 'iMonitor');

	request(parametrosLlamada, (errorLlamada, repuestaMonitor, cuerpoMonitor) => {

		repuestaMonitor = _ampliaRespuestaMonitor(repuestaMonitor, cuerpoMonitor);

		if (errorLlamada) {
			L.e(['Ocurrió un error en la llamada al monitor remoto', destino, errorLlamada], 'iMonitor');
			callback(errorLlamada, repuestaMonitor)
			return;
		}

		repuestaMonitor = _ampliaRespuestaMonitor(repuestaMonitor, cuerpoMonitor);

		if (repuestaMonitor.error) {
			L.e(['El monitor remoto retornó un mensaje de error', destino, repuestaMonitor.statusCode], 'iMonitor');
			callback({
				errno: repuestaMonitor.statusCode,
				code: repuestaMonitor.statusMessage
			}, repuestaMonitor)
			return;
		}

		callback(null, repuestaMonitor);

	});

}


const realizarLlamadaMultiple = (ruta, callback) => {

	iProcesos.consultaProcesos(K.PROCESS_TYPES.MONITOR, null, (errorProcesos, procesos) => {
		if (errorProcesos) {
			L.e(['No se pudieron obtener los procesos de tipo monitor', errorProcesos])
			callback(errorProcesos, null);
			return;
		}

		let destinos = procesos.map(proceso => proceso.host);
		L.d(['Se procede a realizar la llamada multiple', destinos, ruta]);


		let mutex = lock.createMutex();
		let respuestasAlglomeradas = {};
		let respuestasPendientes = destinos.length;

		let funcionAlglomeradora = (destino, error, respuesta) => {

			respuestasAlglomeradas[destino] = {}

			if (error === null) {
				respuestasAlglomeradas[destino].ok = true;
				respuestasAlglomeradas[destino].data = respuesta.body;
			} else {
				respuestasAlglomeradas[destino].ok = false;
				respuestasAlglomeradas[destino].error = error;
			}
			

			mutex.lock(() => {
				respuestasPendientes--;
				if (respuestasPendientes === 0) {
					callback(null, respuestasAlglomeradas);
				}
				mutex.unlock();
			});
		}

		destinos.forEach(destino => {
			realizarLlamadaInterna(destino, ruta, (errorLlamada, respuestaLlamada) => {
				funcionAlglomeradora(destino, errorLlamada, respuestaLlamada);
			})
		});



	})




}

module.exports = {
	realizarLlamadaInterna,
	realizarLlamadaMultiple
}