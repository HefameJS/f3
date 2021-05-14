'use strict';
const C = global.config;
const iFlags = require('interfaces/iflags/iFlags');
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap } = require('./iSapComun');


exports.realizarDevolucion = async function (devolucion) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/devoluciones',
		body: devolucion.generarJSON(),
		timeout: C.sap.timeout.realizarDevolucion
	});

	return await ejecutarLlamadaSap(devolucion.txId, parametrosHttp);
}


exports.consultaDevolucionPDF = async function (numeroDevolucion, txId) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsf_get_document/devo_fedi/' + numeroDevolucion,
		method: 'GET',
		timeout: C.sap.timeout.consultaDevolucionPDF
	});

	try {
		return await ejecutarLlamadaSap(txId, parametrosHttp, { noGenerarEvento: true });
	} catch (errorLlamadaSap) {

		// Cuando la devolución no existe, SAP devuelve un 500 y la incidencia:
		// [ { id: 4, message: 'Error en la generacion del PDF' } ]
		if (Array.isArray(errorLlamadaSap?.cuerpoRespuesta)) {
			let incidenciaSap = errorLlamadaSap.cuerpoRespuesta[0];
			if (incidenciaSap?.id === 4 && incidenciaSap?.message === 'Error en la generacion del PDF') {
				iFlags.sap.quitarError(txId);
				return {};
			}
		}

		throw errorLlamadaSap;

	}




}
