'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

const iEventos = require('interfaces/eventos/iEventos');
const ErrorFedicom = require('modelos/ErrorFedicom');


// PUT /pedido
exports.actualizarPedido = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_PED, 'No se ha implementado el servicio de actualización de pedidos', 501);
	let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
	iEventos.descartar(req, res, cuerpoRespuesta);
	L.xw(txId, [errorFedicom]);

}