'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSapSinEventos, ejecutarLlamadaSap } = require('./iSapComun');


exports.realizarDevolucion = async function (devolucion) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/devoluciones',
		body: devolucion.generarJSON(),
		timeout: C.sap.timeout.realizarDevolucion
	});

	return await ejecutarLlamadaSap(devolucion.txId, parametrosHttp);
}


exports.consultaDevolucionPDF = async function (numeroDevolucion) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsf_get_document/devo_fedi/' + numeroDevolucion,
		method: 'GET',
		timeout: C.sap.timeout.consultaDevolucionPDF
	});

	return await ejecutarLlamadaSapSinEventos(parametrosHttp);

}
