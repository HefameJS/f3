'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externas
const axios = require('axios');

const iEventos = require('interfaces/eventos/iEventos');
const iFlags = require('interfaces/iflags/iFlags');

const ERROR_RESPUESTA_HTTP = 2;
const ERROR_SAP_INALCANZABLE = 3;

class ErrorLlamadaSap {
	constructor(tipo, codigo, mensaje, cuerpoRespuesta) {
		this.tipo = tipo;
		this.codigo = codigo;
		this.mensaje = mensaje;
		this.cuerpoRespuesta = cuerpoRespuesta;
	}

	esErrorHttpSap() {
		return this.tipo === ERROR_RESPUESTA_HTTP;
	}

	esSapNoAlcanzable() {
		return this.tipo === ERROR_SAP_INALCANZABLE;
	}

	generarJSON() {

		let source = 'UNK';
		switch (this.tipo) {
			case ERROR_RESPUESTA_HTTP:
				source = 'SAP';
				break;
			case ERROR_SAP_INALCANZABLE:
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



const ejecutarLlamadaSap = async function (txId, parametros, opciones = {}) {

	if (!opciones) opciones = {}
	let { respuestaHttpCompleta, noGenerarEvento } = opciones;

	if (txId && !noGenerarEvento) iEventos.sap.incioLlamadaSap(txId, parametros);

	let respuestaSap;
	if (!parametros.validateStatus) parametros.validateStatus = (status) => true;

	try {
		respuestaSap = await axios(parametros);
		if (txId) L.xd(txId, ['Obtenida respuesta SAP', respuestaSap.status])
	} catch (errorComunicacion) {
		if (txId) L.xe(txId, ['Error ERROR_SAP_INALCANZABLE', errorComunicacion.errno, errorComunicacion.code])
		
		let errorLlamadaSap = new ErrorLlamadaSap(ERROR_SAP_INALCANZABLE, errorComunicacion.errno, errorComunicacion.code)
		if (txId) iFlags.sap.generaFlags(txId, null, ERROR_SAP_INALCANZABLE);
		if (txId && !noGenerarEvento) iEventos.sap.finLlamadaSap(txId, errorLlamadaSap, null);

		throw errorLlamadaSap;
	}

	// Si SAP no retorna un codigo 2xx, rechazamos
	if (Math.floor(respuestaSap.status / 100) !== 2) {
		let errorLlamadaSap = new ErrorLlamadaSap(ERROR_RESPUESTA_HTTP, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
		
		if (txId) iFlags.sap.generaFlags(txId, respuestaSap, ERROR_RESPUESTA_HTTP);
		if (txId && !noGenerarEvento) iEventos.sap.finLlamadaSap(txId, errorLlamadaSap, null);
		
		throw errorLlamadaSap;
	} else {
		if (txId) iFlags.sap.generaFlags(txId, respuestaSap);
		if (txId && !noGenerarEvento) iEventos.sap.finLlamadaSap(txId, null, respuestaSap);
		return respuestaHttpCompleta ? respuestaSap : respuestaSap.data;
	}

}




module.exports = {
	ErrorLlamadaSap,
	ejecutarLlamadaSap
}