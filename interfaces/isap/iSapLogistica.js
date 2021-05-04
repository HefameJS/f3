'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap, ErrorLlamadaSap } = require('./iSapComun');


const realizarLogistica = (logistica) => {

	return new Promise((resolve, reject) => {

		let nombreSistemaSap = logistica.sapSystem;
		let destinoSap = C.sap.getSistema(nombreSistemaSap);

		if (!destinoSap) {
			reject(ErrorLlamadaSap.generarNoSapSystem());
			return;
		}

		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsd_ent_ped_api/logistica',
			body: logistica.generarJSON(),
			timeout: C.sap.timeout.realizarLogistica
		});

		ejecutarLlamadaSap(logistica.txId, parametrosHttp, resolve, reject);

	});

}

module.exports = {
	realizarLogistica
}