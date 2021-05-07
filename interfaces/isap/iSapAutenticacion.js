'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap } = require('./iSapComun');


exports.verificarCredenciales = async function (solicitudAutenticacion) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zverify_fedi_credentials',
		body: solicitudAutenticacion.generarJSON(),
		timeout: C.sap.timeout.verificarCredenciales
	});

	return await ejecutarLlamadaSap(solicitudAutenticacion.txId, parametrosHttp);

}
