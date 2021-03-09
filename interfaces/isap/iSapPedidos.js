'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;


// Interfaces
const { ejecutarLlamadaSapSinEventos, ejecutarLlamadaSap, ErrorLlamadaSap } = require('./iSapComun');
// const iEventos = require('interfaces/eventos/iEventos');

const realizarPedido = (pedido) => {

	return new Promise((resolve, reject) => {

		let nombreSistemaSap = pedido.sapSystem;
		let destinoSap = C.sap.getSistema(nombreSistemaSap);

		if (!destinoSap) {
			reject(ErrorLlamadaSap.generarNoSapSystem());
			return;
		}

		let parametrosHttp = destinoSap.obtenerParametrosLlamada({
			url: '/api/zsd_ent_ped_api/pedidos',
			body: pedido.generarJSON()
		});

		ejecutarLlamadaSap(pedido.txId, parametrosHttp, resolve, reject);

	});

}


const retransmitirPedido = async function (pedido) {

	let nombreSistemaSap = pedido.sapSystem;
	let destinoSap = C.sap.getSistema(nombreSistemaSap);
	if (!destinoSap) throw ErrorLlamadaSap.generarNoSapSystem();

	let parametrosHttp = destinoSap.obtenerParametrosLlamada({
		url: '/api/zsd_ent_ped_api/pedidos',
		body: pedido.generarJSON()
	});

	let peticionASap = {
		timestamp: new Date(),
		method: parametrosHttp.method,
		headers: parametrosHttp.headers,
		body: parametrosHttp.body,
		url: parametrosHttp.url
	}

	try {
		let respuestaSap = await ejecutarLlamadaSapSinEventos(parametrosHttp);
		return { respuestaSap, peticionASap }
	} catch (errorLlamadaSap) {
		throw { errorLlamadaSap, peticionASap }
	}



}


module.exports = {
	realizarPedido,
	retransmitirPedido
}
