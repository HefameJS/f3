'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externas
const axios = require('axios');

const iEventos = require('interfaces/eventos/iEventos');

const ERROR_TYPE_NO_SAPSYSTEM = 1;
const ERROR_TYPE_SAP_HTTP_ERROR = 2;
const ERROR_TYPE_SAP_UNREACHABLE = 3;

class ErrorLlamadaSap {
	constructor(tipo, codigo, mensaje, cuerpoRespuesta) {
		this.tipo = tipo;
		this.codigo = codigo;
		this.mensaje = mensaje;
		this.cuerpoRespuesta = cuerpoRespuesta;
	}

	esSistemaSapNoDefinido() {
		return this.tipo === ERROR_TYPE_NO_SAPSYSTEM;
	}

	esErrorHttpSap() {
		return this.tipo === ERROR_TYPE_SAP_HTTP_ERROR;
	}

	esSapNoAlcanzable() {
		return this.tipo === ERROR_TYPE_SAP_UNREACHABLE;
	}

	static generarNoSapSystem() {
		return new ErrorLlamadaSap(
			ERROR_TYPE_NO_SAPSYSTEM,
			null,
			'No se encuentra definido el sistema SAP destino'
		)
	}

	generarJSON() {

		let source = 'UNK';
		switch (this.tipo) {
			case ERROR_TYPE_NO_SAPSYSTEM:
				source = 'NO_SAP_SYSTEM';
				break;
			case ERROR_TYPE_SAP_HTTP_ERROR:
				source = 'SAP';
				break;
			case ERROR_TYPE_SAP_UNREACHABLE:
				source = 'NET';
				break;
		}

		return {
			source,
			statusCode: this.codigo || null,
			message: this.mensaje || 'Sin descripción del error'
		}
	}
}


const ejecutarLlamadaSap = (txId, parametros, resolve, reject, respuestaHttpCompleta = false) => {

	iEventos.sap.incioLlamadaSap(txId, parametros);

	axios(parametros)
		// El .then se ejecuta si obtuvimos respuesta de SAP
		.then((respuestaSap) => {

			// Si SAP no retorna un codigo 2xx, rechazamos
			if (Math.floor(respuestaSap.status / 100) !== 2) {
				let errorSap = new ErrorLlamadaSap(ERROR_TYPE_SAP_HTTP_ERROR, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
				iEventos.sap.finLlamadaSap(txId, errorSap, null);
				reject(errorSap);
			} else {
				// Resolvemos el mensaje obtenido de SAP
				iEventos.sap.finLlamadaSap(txId, null, respuestaSap);
				resolve(respuestaHttpCompleta ? respuestaSap : respuestaSap.data);
			}
		})
		// El .catch indica un error en la comunicación (por lo que sea no llegamos a SAP)
		.catch((errorComunicacion) => {
			let error = new ErrorLlamadaSap(ERROR_TYPE_SAP_UNREACHABLE, errorComunicacion.errno, errorComunicacion.code)
			iEventos.sap.finLlamadaSap(txId, error, null);
			reject(error);
		});
}

const ejecutarLlamadaSapSinEventos = async function (parametros, respuestaHttpCompleta = false) {

	try {
		let respuestaSap = await axios(parametros);
		// Si SAP no retorna un codigo 2xx, rechazamos
		if (Math.floor(respuestaSap.status / 100) !== 2) {
			throw new ErrorLlamadaSap(ERROR_TYPE_SAP_HTTP_ERROR, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
		} else {
			return respuestaHttpCompleta ? respuestaSap : respuestaSap.data;
		}
	} catch (errorComunicacion) {
		throw new ErrorLlamadaSap(ERROR_TYPE_SAP_UNREACHABLE, errorComunicacion.errno, errorComunicacion.code)
	}
}



module.exports = {
	ErrorLlamadaSap,
	ejecutarLlamadaSap,
	ejecutarLlamadaSapSinEventos
}