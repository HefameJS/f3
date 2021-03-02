'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap, ErrorLlamadaSap } = require('./iSapComun');
// const iEventos = require('interfaces/eventos/iEventos');

const realizarPedido = (pedido) => {

	return new Promise((resolve, reject) => {

		let nombreSistemaSap = pedido.sapSystem;
		let destinoSap = C.sap.getSistema(nombreSistemaSap);

		if (!destinoSap) {
			reject(ErrorLlamadaSap.generarNoSapSystem());
			return;
		}

		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsd_ent_ped_api/pedidos',
			body: pedido.generarJSON()
		});

		ejecutarLlamadaSap(pedido.txId, parametrosHttp, resolve, reject);

	});

}

/*
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

	let peticionASap = {
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
				errno: respuestaSap.statusCode,
				code: respuestaSap.statusMessage
			}, respuestaSap, peticionASap);
			return;
		}

		callback(null, respuestaSap, peticionASap);
	});

}
*/

module.exports = {
	realizarPedido,
	//retransmitirPedido
}
