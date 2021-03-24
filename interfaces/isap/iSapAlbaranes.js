'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap, ErrorLlamadaSap } = require('./iSapComun');


exports.consultaAlbaranJSON = (numeroAlbaran, txId) => {

	return new Promise(async function (resolve, reject) {

		let destinoSap = C.sap.getSistemaPorDefecto();
		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsd_orderlist_api/view/' + numeroAlbaran,
			method: 'GET',
			timeout: C.sap.timeout.consultaAlbaranJSON
		});

		ejecutarLlamadaSap(txId, parametrosHttp, resolve, reject);

	});

}



exports.consultaAlbaranPDF = (numeroAlbaran, txId) => {

	return new Promise(async function (resolve, reject) {

		let destinoSap = C.sap.getSistemaPorDefecto();
		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsf_get_document/proforma/' + numeroAlbaran,
			method: 'GET',
			timeout: C.sap.timeout.consultaAlbaranPDF
		});

		ejecutarLlamadaSap(txId, parametrosHttp, resolve, reject);

	});

}


exports.listadoAlbaranes = (consultaAlbaran, txId) => {

	return new Promise(async function (resolve, reject) {

		let destinoSap = C.sap.getSistemaPorDefecto();
		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsd_orderlist_api/query_tree/?query=' + consultaAlbaran.toQueryString(),
			method: 'GET',
			timeout: C.sap.timeout.listadoAlbaranes
		});

		ejecutarLlamadaSap(txId, parametrosHttp, resolve, reject);

	});
}
