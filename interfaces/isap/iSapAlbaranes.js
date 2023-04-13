'use strict';
const C = global.config;
const L = require('global/logger');
const iFlags = require('interfaces/iflags/iFlags');
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap } = require('./iSapComun');


exports.consultaAlbaranJSON = async function (numeroAlbaran, cliente, txId ) {

	let url = `/api/zsd_orderlist_api/view/${numeroAlbaran}?cliente=${cliente}`;

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: url,
		method: 'GET',
		timeout: C.sap.timeout.consultaAlbaranJSON
	});

	try {
		return await ejecutarLlamadaSap(txId, parametrosHttp, { noGenerarEvento: true });
	} catch (errorSap) {

		// Cuando el albarán no existe, SAP devuelve un código HTTP 503 y en el cuerpo de respuesta:
		// {type: 'E', id: 'E202004011151', .... , message: 'La informacion no esta disponible..'
		if (errorSap?.codigo === 503 && errorSap?.cuerpoRespuesta?.message === 'La informacion no esta disponible..') {
			iFlags.sap.quitarError(txId);
			return {};
		}

		throw errorSap;
	}

}



exports.consultaAlbaranPDF = async function (numeroAlbaran, txId) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsf_get_document/proforma/' + numeroAlbaran,
		method: 'GET',
		timeout: C.sap.timeout.consultaAlbaranPDF
	});

	return await ejecutarLlamadaSap(txId, parametrosHttp, { noGenerarEvento: true });

}


exports.listadoAlbaranes = async function (consultaAlbaran, txId) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsd_orderlist_api/query_tree/?query=' + consultaAlbaran.toQueryString(),
		method: 'GET',
		timeout: C.sap.timeout.listadoAlbaranes
	});

	return await ejecutarLlamadaSap(txId, parametrosHttp, { noGenerarEvento: true });

}
