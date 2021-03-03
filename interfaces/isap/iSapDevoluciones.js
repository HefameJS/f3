'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap, ErrorLlamadaSap } = require('./iSapComun');




exports.realizarDevolucion = (devolucion) => {

	return new Promise((resolve, reject) => {

		let nombreSistemaSap = devolucion.sapSystem;
		let destinoSap = C.sap.getSistema(nombreSistemaSap);

		if (!destinoSap) {
			reject(ErrorLlamadaSap.generarNoSapSystem());
			return;
		}

		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsd_ent_ped_api/devoluciones',
			body: devolucion.generarJSON()
		});

		ejecutarLlamadaSap(devolucion.txId, parametrosHttp, resolve, reject);

	});

}


exports.consultaDevolucionPDF = (numeroDevolucion, txId) => {

	return new Promise((resolve, reject) => {

		let destinoSap = C.sap.getSistemaPorDefecto();
		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsf_get_document/devo_fedi/' + numeroDevolucion,
			method: 'GET',
			timeout: 10000
		});

		ejecutarLlamadaSap(txId, parametrosHttp, resolve, reject);

	});
}
