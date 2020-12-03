'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

const iSapComun = require('./iSapComun');
const DestinoSap = require('model/ModeloDestinoSap');

const request = require('request');


exports.realizarDevolucion = (txId, devolucion, callback) => {
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

exports.consultaDevolucionPDF = (txId, numeroDevolucion, callback) => {

	let destinoSap = DestinoSap.porDefecto();
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zsf_get_document/devo_fedi/' + numeroDevolucion,
		method: 'GET',
	});
	parametrosHttp.timeout = 10000;

	L.xd(txId, ['Enviando a SAP consulta de devolución PDF', parametrosHttp]);

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
