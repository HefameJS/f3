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

// 
let tokenIntermonitor = null;

/**
 * Condensa en un solo objeto la respuesta dada por un monitor remoto.
 * La respuesta se completa adjuntando la propiedad body el cuerpo de la respuesta
 * y una propiedad que indica si hubo error en la respuesta (codigo respuesta HTTP distinto de 2xx)
 */
const _ampliaRespuestaMonitor = (repuestaMonitor, cuerpoMonitor) => {
	if (!repuestaMonitor) repuestaMonitor = { statusCode: -1, statusMessage: 'Respuesta de llamada InterMonitor nula' };
	repuestaMonitor.body = cuerpoMonitor;
	repuestaMonitor.error = Math.floor(repuestaMonitor.statusCode / 100) !== 2;
	return repuestaMonitor;
}

const _obtenerTokenIntermonitor = () => {

	if (!tokenIntermonitor) {
		tokenIntermonitor = iTokens.generarTokenInterFedicom();
		return tokenIntermonitor;
	}

	let estadoToken = iTokens.verificarToken(tokenIntermonitor);
	if (!estadoToken.meta.ok) {
		tokenIntermonitor = iTokens.generarTokenInterFedicom();
		return tokenIntermonitor;
	} else {
		return tokenIntermonitor;
	}

}
_obtenerTokenIntermonitor();

/**
 * Realiza la llamada intermonitor al destino indicado.
 * @param {*} destino 
 * @param {*} ruta 
 * @param {*} callback 
 */
const _realizarLlamadaAMonitor = (destino, ruta, opciones, callback) => {

	let parametrosLlamada = opciones;

	parametrosLlamada.followAllRedirects = true;
	parametrosLlamada.uri = 'http://' + destino + ':5001' + ruta;
	parametrosLlamada.json = true;
	parametrosLlamada.headers = {
		...parametrosLlamada.headers,
		Authorization: 'Bearer ' + _obtenerTokenIntermonitor(),
	}


	L.e(['Realizando llamada a monitor remoto', parametrosLlamada], 'iMonitor');

	request(parametrosLlamada, (errorLlamada, repuestaMonitor, cuerpoMonitor) => {

		repuestaMonitor = _ampliaRespuestaMonitor(repuestaMonitor, cuerpoMonitor);

		if (errorLlamada) {
			L.e(['Ocurrió un error en la llamada al monitor remoto', destino, errorLlamada], 'iMonitor');
			callback(errorLlamada, repuestaMonitor)
			return;
		}

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


/**
 * Realiza la llamada intermonitor a la lista de destinos pasada.
 * IMPRESCINDIBLE QUE LA LISTA DE DESTINOS SEA UN ARRAY Y CONTENGA AL MENOS UN DESTINO.
 * @param {*} destinos Array con los nombres de los destinos.
 * @param {*} ruta 
 * @param {*} callback 
 */
const _llamadaAMultiplesDestinos = (destinos, ruta, opciones, callback) => {


	L.d(['Se procede a realizar la llamada a multiples destinos', destinos, ruta]);

	if (!destinos || destinos.length === 0) {
		L.e(['No está permitido llamar a _llamadaAMultiplesDestinos() sin especificar ningún destino !', destinos]);
		callback(new Error('No se ha especificado ningún destino'), null);
		return;
	}

	let mutex = lock.createMutex();
	let respuestasAlglomeradas = {};
	let respuestasPendientes = destinos.length;

	let funcionAlglomeradora = (destino, error, respuesta) => {

		respuestasAlglomeradas[destino] = {}

		if (error) {
			respuestasAlglomeradas[destino].ok = false;
			if (respuesta.body) respuestasAlglomeradas[destino].error = respuesta.body;
			else respuestasAlglomeradas[destino].error = error;
		} else {
			respuestasAlglomeradas[destino].ok = !respuesta.error;
			if (respuesta.body) respuestasAlglomeradas[destino].respuesta = respuesta.body;
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
		_realizarLlamadaAMonitor(destino, ruta, opciones, (errorLlamada, respuestaLlamada) => {
			funcionAlglomeradora(destino, errorLlamada, respuestaLlamada);
		})
	});
}


/**
 * Realiza la llamada intermonitor a la lista de destinos pasada.
 * Puede pasarse un único destino como un string, o una lista de destinos en un array de strings
 * Si no se indica ningún destino, se busca en el registro de procesos todos los procesos de tipo monitor.
 * @param {*} destinos 
 * @param {*} ruta 
 * @param {*} opciones
 * @param {*} callback 
 */
const realizarLlamadaMultiple = (destinos, ruta, opciones, callback) => {

	if (typeof opciones === 'function') {
		callback = opciones;
		opciones = {};
	}


	if (destinos && destinos.forEach && destinos.length > 0) {
		// Destinos es un array con al menos una posicion.
		_llamadaAMultiplesDestinos(destinos, ruta, opciones, callback);
		return;
	} else if (destinos) {
		// Destinos no es vacío, pero no es un array,
		_llamadaAMultiplesDestinos([destinos], ruta, opciones, callback);
		return;
	} else {

		iProcesos.consultaProcesos(K.PROCESS_TYPES.MONITOR, null, (errorProcesos, procesos) => {
			if (errorProcesos) {
				L.e(['No se pudieron obtener los procesos de tipo monitor', errorProcesos])
				callback(errorProcesos, null);
				return;
			}

			let destinos = procesos.map(proceso => proceso.host);
			if (destinos && destinos.forEach && destinos.length > 0) {
				_llamadaAMultiplesDestinos(destinos, ruta, opciones, callback);
				return;
			} else {
				L.e(['No se obtuvieron procesos de tipo monitor'])
				callback(new Error('No se obtuvieron procesos de tipo monitor'), null);
				return;
			}


		});
	}


}


module.exports = {
	realizarLlamadaMultiple
}