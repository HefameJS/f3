'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;


// Interfaces
const { ejecutarLlamadaSap } = require('./iSapComun');

exports.realizarPedido = async function (pedido) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/pedidos',
		body: pedido.generarJSON(),
		timeout: C.sap.timeout.realizarPedido
	});

	return await ejecutarLlamadaSap(pedido.txId, parametrosHttp);

}


exports.retransmitirPedido = async function (pedido) {

	let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/pedidos',
		body: pedido.generarJSON(),
		timeout: C.sap.timeout.realizarPedido
	});

	let peticionASap = {
		timestamp: new Date(),
		method: parametrosHttp.method,
		headers: parametrosHttp.headers,
		body: parametrosHttp.data,
		url: parametrosHttp.url
	}

	try {
		let respuestaSap = await ejecutarLlamadaSap(null, parametrosHttp, { noGenerarEvento: true, respuestaHttpCompleta: true });
		respuestaSap.peticion = peticionASap;
		return respuestaSap;
	} catch (errorLlamadaSap) {
		errorLlamadaSap.peticion = peticionASap;
		throw errorLlamadaSap;
	}

}

