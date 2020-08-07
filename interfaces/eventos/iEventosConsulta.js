'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
//const iFlags = require('interfaces/iFlags');

// Modelos

//const ObjectID = iMongo.ObjectID;

const consultaPedido = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroPedido = (req.query ? req.query.numeroPedido : null) || (req.params ? req.params.numeroPedido : null) || null;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTA_PEDIDO, estadoFinal);
	transaccion['$set'].pedidoConsultado = numeroPedido;
	//TODO: En 'cuerpoRespuesta' podríamos rascar el codigo del cliente y añadirlo al campo 'client' de la transaccion

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA PEDIDO'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}


const consultaDevolucion = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroDevolucion = (req.query ? req.query.numeroDevolucion : null) || (req.params ? req.params.numeroDevolucion : null) || null;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTA_DEVOLUCION, estadoFinal);
	transaccion['$set'].devolucionConsultada = numeroDevolucion;
	//TODO: En 'cuerpoRespuesta' podríamos rascar el codigo del cliente y añadirlo al campo 'client' de la transaccion

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA DEVOLUCION'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}



const consultaLogistica = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroLogistica = (req.query ? req.query.numeroLogistica : null) || (req.params ? req.params.numeroLogistica : null) || null;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTA_LOGISTICA, estadoFinal);
	transaccion['$set'].logisticaConsultada = numeroLogistica;

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA LOGISTICA'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}


module.exports = {
	consultaPedido,
	consultaDevolucion,
	consultaLogistica
}