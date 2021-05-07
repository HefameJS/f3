'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externas
const axios = require('axios');

const iEventos = require('interfaces/eventos/iEventos');

const ERROR_TYPE_SAP_HTTP_ERROR = 2;
const ERROR_TYPE_SAP_UNREACHABLE = 3;

class ErrorLlamadaSap {
	constructor(tipo, codigo, mensaje, cuerpoRespuesta) {
		this.tipo = tipo;
		this.codigo = codigo;
		this.mensaje = mensaje;
		this.cuerpoRespuesta = cuerpoRespuesta;
	}

	esErrorHttpSap() {
		return this.tipo === ERROR_TYPE_SAP_HTTP_ERROR;
	}

	esSapNoAlcanzable() {
		return this.tipo === ERROR_TYPE_SAP_UNREACHABLE;
	}

	generarJSON() {

		let source = 'UNK';
		switch (this.tipo) {
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



const ejecutarLlamadaSap = async function(txId, parametros, respuestaHttpCompleta = false) {

	iEventos.sap.incioLlamadaSap(txId, parametros);

	let respuestaSap;

	try {
		respuestaSap = await axios(parametros);
	} catch (errorComunicacion) {
		let errorLlamadaSap = new ErrorLlamadaSap(ERROR_TYPE_SAP_UNREACHABLE, errorComunicacion.errno, errorComunicacion.code)
		iEventos.sap.finLlamadaSap(txId, errorLlamadaSap, null);
		throw errorLlamadaSap;
	}

	// Si SAP no retorna un codigo 2xx, rechazamos
	if (Math.floor(respuestaSap.status / 100) !== 2) {
		let errorLlamadaSap = new ErrorLlamadaSap(ERROR_TYPE_SAP_HTTP_ERROR, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
		iEventos.sap.finLlamadaSap(txId, errorLlamadaSap, null);
		throw errorLlamadaSap;
	} else {
		iEventos.sap.finLlamadaSap(txId, null, respuestaSap);
		return respuestaHttpCompleta ? respuestaSap : respuestaSap.data;
	}
	
}

const ejecutarLlamadaSapSinEventos = async function (parametros, respuestaHttpCompleta = false) {
	let respuestaSap;

	if (!parametros.validateStatus) validateStatus = (status) => true;
	try {
		respuestaSap = await axios(parametros);
	} catch (errorComunicacion) {
		throw new ErrorLlamadaSap(ERROR_TYPE_SAP_UNREACHABLE, errorComunicacion.errno, errorComunicacion.code)
	}

	// Si SAP no retorna un codigo 2xx, rechazamos
	if (Math.floor(respuestaSap.status / 100) !== 2) {
		throw new ErrorLlamadaSap(ERROR_TYPE_SAP_HTTP_ERROR, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
	} else {
		return respuestaHttpCompleta ? respuestaSap : respuestaSap.data;
	}

}



module.exports = {
	ErrorLlamadaSap,
	ejecutarLlamadaSap,
	ejecutarLlamadaSapSinEventos
}