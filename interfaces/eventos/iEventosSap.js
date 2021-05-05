'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');

module.exports.incioLlamadaSap = (txId, parametrosLlamada) => {

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.ESPERANDO_INCIDENCIAS
		},
		$set: {
			sapRequest: {
				timestamp: new Date(),
				method: parametrosLlamada.method,
				headers: parametrosLlamada.headers,
				body: parametrosLlamada.data,
				url: parametrosLlamada.url
			}
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento incioLlamadaSap'], 'txBuffer');
	iMongo.transaccion.grabarEnMemoria(transaccion);
}

module.exports.finLlamadaSap = (txId, errorLlamadaSap, respuestaSap) => {

	let respuestaSapTransaccion = {};

	if (errorLlamadaSap) { // Error en la llamada a SAP
		respuestaSapTransaccion = {
			timestamp: new Date(),
			error: errorLlamadaSap.generarJSON()
		}
	} else {
		// Respuesta correcta de SAP
		respuestaSapTransaccion = {
			timestamp: new Date(),
			statusCode: respuestaSap.status,
			headers: respuestaSap.headers,
			body: respuestaSap.data
		}
	}

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.INCIDENCIAS_RECIBIDAS
		},
		$set: {
			sapResponse: respuestaSapTransaccion
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento finLlamadaSap'], 'txBuffer');
	iMongo.transaccion.grabarEnMemoria(transaccion);
}

module.exports.errorConfirmacionPedido = (req, res, estado, datosExtra = {}) => {

	let txId = req.txId;
	let { crcSap } = datosExtra;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, {}, K.TX_TYPES.CONFIRMACION_PEDIDO, estado)	
	if (crcSap) transaccion['$set'].crcSap = crcSap;

	L.xi(txId, ['Emitiendo COMMIT para evento ErrorConfirmacionPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.CONFIRMACION_PEDIDO, estado, [req.body]);
}

module.exports.confirmacionPedido = (req, txIdConfirmado, estadoTransmisionConfirmada, datosExtra = {}) => {

	let txId = req.txId;
	let { crcSap, numerosPedidoSAP } = datosExtra;

	// NOTA: esta transacción no tiene "evento de cierre", es decir, 
	// no guardamos la respuesta que le damos a SAP porque es completamente irrelevante.
	let transaccion = iEventosComun.generarEventoDeApertura(req, K.TX_TYPES.CONFIRMACION_PEDIDO, K.TX_STATUS.OK)

	transaccion['$set'].confirmingId = txIdConfirmado;
	if (crcSap) transaccion['$set'].crcSap = crcSap;


	let transaccionActualizacionConfirmada = {
		$setOnInsert: {
			_id: txIdConfirmado,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estadoTransmisionConfirmada
		},
		$set: {
			numerosPedidoSAP: numerosPedidoSAP
		},
		$push: {
			sapConfirms: {
				txId: txId,
				timestamp: new Date(),
				sapSystem: req.identificarUsuarioAutenticado().usuario
			}
		}
	}

	L.xi(txId, ['Emitiendo COMMIT para evento ConfirmacionPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	iMongo.transaccion.grabar(transaccionActualizacionConfirmada);

	L.evento(txIdConfirmado, K.TX_TYPES.CONFIRMACION_PEDIDO, estadoTransmisionConfirmada, numerosPedidoSAP);
}
