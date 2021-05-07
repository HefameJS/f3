'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Helpers
const { ejecutarLlamadaSapSinEventos } = require('./iSapComun');



const ping = async function () {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
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
	ping,
	autenticacion: require('./iSapAutenticacion'),
	pedidos: require('./iSapPedidos'),
	devoluciones: require('./iSapDevoluciones'),
	albaranes: require('./iSapAlbaranes'),
	logistica: require('./iSapLogistica'),
}
