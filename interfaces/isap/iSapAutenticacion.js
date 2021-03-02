'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap, ErrorLlamadaSap } = require('./iSapComun');
// const iEventos = require('interfaces/eventos/iEventos');


const verificarCredenciales = function (solicitudAutenticacion) {

	return new Promise((resolve, reject) => {

		let nombreSistemaSap = solicitudAutenticacion.sapSystem;
		let destinoSap = C.sap.getSistema(nombreSistemaSap);

		if (!destinoSap) {
			reject(ErrorLlamadaSap.generarNoSapSystem());
			return;
		}

		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zverify_fedi_credentials',
			body: solicitudAutenticacion.generarJSON()
		});

		ejecutarLlamadaSap(solicitudAutenticacion.txId, parametrosHttp, resolve, reject);

	});

}

module.exports = {
	verificarCredenciales
}
