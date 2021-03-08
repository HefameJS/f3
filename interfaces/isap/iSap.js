'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externo
const axios = require('axios');

// Helpers
const { ErrorLlamadaSap, ejecutarLlamadaSapSinEventos } = require('./iSapComun');



const ping = async function (nombreSistemaSap = null) {


	let destinoSap = C.sap.getSistema(nombreSistemaSap);

	if (!destinoSap) {
		L.w(['El sistema destino no está definido', ErrorLlamadaSap.generarNoSapSystem()])
		return false;
	}

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/pedidos/avalibity',
		timeout: 1000
	});

	try {
		let respuestaSap = await ejecutarLlamadaSapSinEventos(parametrosHttp);
		return Boolean(respuestaSap?.message === 'Servicio Disponible');
	} catch (errorComunicacion) {
		L.w(['El ping a SAP devuelve un error', errorComunicacion])
		return false;
	}

}



module.exports = {
	ping: ping,
	autenticacion: require('./iSapAutenticacion'),
	pedidos: require('./iSapPedidos'),
	devoluciones: require('./iSapDevoluciones'),
	albaranes: require('./iSapAlbaranes'),
	logistica: require('./iSapLogistica'),
}
