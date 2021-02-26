'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externas
const request = require('request');

// Interfaces
const iSapComun = require('./iSapComun');
const iCacheCredencialesSap = require('./iCacheCredencialesSap');
// const iEventos = require('interfaces/eventos/iEventos');


const verificarCredenciales = (txId, solicitudAutenticacion, callback) => {

	// Salvo que se indique, buscaremos si tenemos los datos del cliente en la cache de credenciales
	if (!solicitudAutenticacion.noCache) {
		let resultadoCache = iCacheCredencialesSap.chequearSolicitud(solicitudAutenticacion);
		if (resultadoCache) {
			L.xd(txId, 'Se produjo un acierto de caché en la credencial de usuario.', 'credentialCache');

			let respuestaSapSimulada = { body: { username: solicitudAutenticacion.username }, errorSap: false }
			callback(null, respuestaSapSimulada);
			return;
		}
	}

	let nombreSistemaSap = solicitudAutenticacion.sapSystem;


	let destinoSap = C.sap.getSistema(nombreSistemaSap);
	if (!destinoSap) {
		callback(iSapComun.NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		path: '/api/zverify_fedi_credentials',
		body: solicitudAutenticacion
	});


	// iEventos.sap.incioLlamadaSap(txId, parametrosHttp);

	request(parametrosHttp, (errorComunicacion, respuestaSap, cuerpoSap) => {

		respuestaSap = iSapComun.ampliaRespuestaSap(respuestaSap, cuerpoSap);
		// iEventos.sap.finLlamadaSap(txId, errorComunicacion, respuestaSap);

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

		// Solo si SAP responde con el nombre del usuario guardamos la entrada en caché
		if (!solicitudAutenticacion.noCache && cuerpoSap.username && cuerpoSap.username.length > 0) {
			iCacheCredencialesSap.agregarEntrada(solicitudAutenticacion);
		}

		callback(null, respuestaSap);

	});

}

module.exports = {
	verificarCredenciales
}
