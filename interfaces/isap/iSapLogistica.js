'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externo
const request = require('request');

// Interfaces
const iSapComun = require('./iSapComun');
const iEventos = require('interfaces/eventos/iEventos');

// Modelos
const DestinoSap = require('modelos/DestinoSap');


const realizarLogistica = (txId, logistica, callback) => {

	let destinoSap = DestinoSap.desdeNombre(logistica.sapSystem);
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_ent_ped_api/logistica',
		body: logistica
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

module.exports = {
	realizarLogistica
}