'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iflags/iFlags');


const consultaPedido = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroPedido = (req.query ? req.query.numeroPedido : null) || (req.params ? req.params.numeroPedido : null) || null;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTA_PEDIDO, estadoFinal);
	transaccion['$set'].pedidoConsultado = numeroPedido;
	//TODO: En 'cuerpoRespuesta' podríamos rascar el codigo del cliente y añadirlo al campo 'client' de la transaccion
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA PEDIDO'], 'qtxCommit');
	
	iMongo.transaccion.grabar(transaccion);
}

const consultaDevolucion = (req, res, cuerpoRespuesta, estadoFinal, formatoConsulta) => {

	let txId = req.txId;
	let numeroDevolucion = (req.query ? req.query.numeroDevolucion : null) || (req.params ? req.params.numeroDevolucion : null) || null;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTA_DEVOLUCION, estadoFinal);
	transaccion['$set'].devolucionConsultada = numeroDevolucion;
	transaccion['$set'].formatoConsulta = formatoConsulta;
	//TODO: En 'cuerpoRespuesta' podríamos rascar el codigo del cliente y añadirlo al campo 'client' de la transaccion
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA DEVOLUCION'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}

const consultaLogistica = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroLogistica = (req.query ? req.query.numeroLogistica : null) || (req.params ? req.params.numeroLogistica : null) || null;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTA_LOGISTICA, estadoFinal);
	transaccion['$set'].logisticaConsultada = numeroLogistica;
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA LOGISTICA'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}

const consultaAlbaran = (req, res, cuerpoRespuesta, estadoFinal, numeroAlbaran, formatoConsulta) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTAR_ALBARAN, estadoFinal);
	transaccion['$set'].albaranConsultado = numeroAlbaran;
	transaccion['$set'].formatoConsulta = formatoConsulta;
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA ALBARAN'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}

const consultaListadoAlbaranes = (req, res, cuerpoRespuesta, estadoFinal, datosConsulta) => {


	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.BUSCAR_ALBARANES, estadoFinal);
	transaccion['$set'] = {...transaccion['$set'], ...datosConsulta};
	// Extra: Estos son los datos de la consulta que pueden venir:
	// let { consultaSap, numeroResultadosTotales, numeroResultadosEnviados} = datosConsulta;
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA LISTADO ALBARANES'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}

const consultaFactura = (req, res, cuerpoRespuesta, estadoFinal, numeroFactura, formatoConsulta) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONSULTAR_FACTURA, estadoFinal);
	transaccion['$set'].facturaConsultada = numeroFactura;
	transaccion['$set'].formatoConsulta = formatoConsulta;
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA FACTURA'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}

const consultaListadoFacturas = (req, res, cuerpoRespuesta, estadoFinal, datosConsulta) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.BUSCAR_FACTURAS, estadoFinal);
	transaccion['$set'] = { ...transaccion['$set'], ...datosConsulta };
	// Extra: Estos son los datos de la consulta que pueden venir:
	// let { consultaSap, numeroResultadosTotales, numeroResultadosEnviados} = datosConsulta;
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA LISTADO FACTURAS'], 'qtxCommit');
	iMongo.transaccion.grabar(transaccion);
}


module.exports = {
	consultaPedido,
	consultaDevolucion,
	consultaLogistica,
	consultaAlbaran,
	consultaListadoAlbaranes,
	consultaFactura,
	consultaListadoFacturas
}