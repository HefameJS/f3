'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap } = require('./iSapComun');


exports.realizarLogistica = async function (logistica) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/logistica',
		body: logistica.generarJSON(),
		timeout: C.sap.timeout.realizarLogistica
	});

	return await ejecutarLlamadaSap(logistica.txId, parametrosHttp);
}
