'use strict';
const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;

// Externo
const request = require('request');

// Interfaces
const iEventos = require(BASE + 'interfaces/eventos/iEventos');

// Modelos
const DestinoSap = require(BASE + 'model/ModeloDestinoSap');

// Helpers
const iSapComun = require('./iSapComun');


const ping = (nombreSistemaSap, callback) => {
	let destinoSap = DestinoSap.desdeNombre(nombreSistemaSap);
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_ent_ped_api/pedidos/avalibity' /* AVALIBITY is gud englis */
	});

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);

		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, false);
			return;
		}

		if (respuestaSap.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: respuestaSap.statusCode,
				code: respuestaSap.statusMessage
			}, false);
			return;
		}

		callback(null, true, nombreSistemaSap);

	});
}

const realizarPedido = (txId, pedido, callback) => {

	let destinoSap = DestinoSap.desdeNombre(pedido.sapSystem);
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_ent_ped_api/pedidos',
		body: pedido
	});

	iEventos.sap.incioLlamadaSap(txId, parametrosHttp);

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);
		iEventos.sap.finLlamadaSap(txId, errorComunicacion, respuestaSap);

		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, respuestaSap);
			return;
		}

		if (respuestaSap.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: respuestaSap.statusCode,
				code: respuestaSap.statusMessage
			}, respuestaSap);
			return;
		}

		callback(null, respuestaSap);

	});
}

const realizarDevolucion = (txId, devolucion, callback) => {
	let destinoSap = DestinoSap.desdeNombre(devolucion.sapSystem);
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_ent_ped_api/devoluciones',
		body: devolucion
	});

	iEventos.sap.incioLlamadaSap(txId, parametrosHttp);

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);
		iEventos.sap.finLlamadaSap(txId, errorComunicacion, respuestaSap);


		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, respuestaSap);
			return;
		}

		if (respuestaSap.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: respuestaSap.statusCode,
				code: respuestaSap.statusMessage
			}, respuestaSap);
			return;
		}

		callback(null, respuestaSap);

	});
}

const retransmitirPedido = (pedido, callback) => {


	let destinoSap = DestinoSap.desdeNombre(pedido.sapSystem);
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_ent_ped_api/pedidos',
		body: pedido
	});

	var peticionASap = {
		timestamp: new Date(),
		method: parametrosHttp.method,
		headers: parametrosHttp.headers,
		body: parametrosHttp.body,
		url: parametrosHttp.url
	}

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {
		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);

		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, respuestaSap, peticionASap);
			return;
		}

		if (respuestaSap.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: sapRrespuestaSapesponse.statusCode,
				code: respuestaSap.statusMessage
			}, respuestaSap, peticionASap);
			return;
		}

		callback(null, respuestaSap, peticionASap);
	});

}

module.exports = {
	ping: ping,
	autenticacion: require('./iSapAutenticacion'),
	realizarPedido: realizarPedido,
	realizarDevolucion: realizarDevolucion,
	retransmitirPedido: retransmitirPedido,
	albaranes: require('./iSapAlbaranes'),
	logistica: require('./iSapLogistica'),
}
