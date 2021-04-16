'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSapSinEventos } = require('./iSapComun');


exports.consultaAlbaranJSON = async function (numeroAlbaran, txId) {

	let destinoSap = C.sap.getSistemaPorDefecto();
	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		url: '/api/zsd_orderlist_api/view/' + numeroAlbaran,
		method: 'GET',
		timeout: C.sap.timeout.consultaAlbaranJSON
	});

	return await ejecutarLlamadaSapSinEventos(parametrosHttp);
}



exports.consultaAlbaranPDF = async function (numeroAlbaran, txId) {


	let destinoSap = C.sap.getSistemaPorDefecto();
	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		url: '/api/zsf_get_document/proforma/' + numeroAlbaran,
		method: 'GET',
		timeout: C.sap.timeout.consultaAlbaranPDF
	});

	return await ejecutarLlamadaSapSinEventos(parametrosHttp);

}


exports.listadoAlbaranes = async function (consultaAlbaran, txId) {

	let destinoSap = C.sap.getSistemaPorDefecto();
	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		url: '/api/zsd_orderlist_api/query_tree/?query=' + consultaAlbaran.toQueryString(),
		method: 'GET',
		timeout: C.sap.timeout.listadoAlbaranes
	});

	return await ejecutarLlamadaSapSinEventos(parametrosHttp);

}
