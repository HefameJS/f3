'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const iSapComun = require('./iSapComun');
const DestinoSap = require(BASE + 'model/ModeloDestinoSap');

const request = require('request');


exports.consultaAlbaranJSON = (txId, numeroAlbaran, callback) => {

	let destinoSap = DestinoSap.porDefecto();
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_orderlist_api/view/' + numeroAlbaran,
		method: 'GET'
	});

	L.xd(txId, ['Enviando a SAP consulta de albarán', parametrosHttp]);

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);

		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, null);
			return;
		}

		if (respuestaSap.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: respuestaSap.statusCode,
				code: respuestaSap.statusMessage
			}, null);
			return;
		}

		callback(null, respuestaSap);


	});
}

exports.consultaAlbaranPDF = (txId, numeroAlbaran, callback) => {

	let destinoSap = DestinoSap.porDefecto();
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsf_get_document/proforma/' + numeroAlbaran,
		method: 'GET'
	});

	L.xd(txId, ['Enviando a SAP consulta de albarán PDF', parametrosHttp]);

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);

		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, null);
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

		callback(null, respuestaSap);

	});
}

exports.listadoAlbaranes = (txId, consultaAlbaran, callback) => {
	let destinoSap = DestinoSap.porDefecto();
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsd_orderlist_api/query/?query=' + consultaAlbaran.toQueryString(),
		method: 'GET'
	});

	L.xd(txId, ['Enviando a SAP consulta de listado de albaranes', parametrosHttp]);

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);

		if (errorComunicacion) {
			errorComunicacion.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(errorComunicacion, null);
			return;
		}

		if (respuestaSap.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: respuestaSap.statusCode,
				code: respuestaSap.statusMessage
			}, null);
			return;
		}

		callback(null, respuestaSap);

	});
}
