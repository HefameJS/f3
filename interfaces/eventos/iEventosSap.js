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
				body: parametrosLlamada.body,
				url: parametrosLlamada.url
			}
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento incioLlamadaSap'], 'txBuffer');
	iMongo.transaccion.grabarEnMemoria(transaccion);
}

module.exports.finLlamadaSap = (txId, errorLlamadaSap, respuestaSap) => {
	/*
		respuestaSapTransaccion: El objeto que se incluye en el objeto de la transaccion como 'sapResponse'
		puede ser de 2 formas:
		Forma SIN error:
			respuestaSapTransaccion = {
				timestamp: new Date(),
				statusCode: respuestaSap.statusCode,
				headers: respuestaSap.headers,
				body: respuestaSap.body
			}
		
		Forma CON error:
			Si hay un error en la llamada a SAP (error en la red como que el socket no responde, da timeout, DNS not found ...,
				o se dan errores de protocolo como SSL):
				respuestaSapTransaccion = {
					timestamp: new Date(),
					error: {
						source: 'NET',
						statusCode: errorLlamadaSap.errno || false,
						message: errorLlamadaSap.message || 'Sin descripción del error'
					}
				}
			Si SAP da respuesta de error (HTTP 500, 404, 401, 4xx, 5xx ...):
				respuestaSapTransaccion = {
					timestamp: new Date(),
					error: {
						source: 'SAP',
						statusCode: respuestaSap.statusCode,
						message: respuestaSap.statusMessage
					}
				}
	*/
	
	let respuestaSapTransaccion = {};

	if (errorLlamadaSap) { // Error de RED
		respuestaSapTransaccion = {
			timestamp: new Date(),
			error: {
				source: 'NET',
				statusCode: errorLlamadaSap.errno || false,
				message: errorLlamadaSap.message || 'Sin descripción del error'
			}
		}
	} else {
		if (respuestaSap.errorSap) { // Error de SAP
			respuestaSapTransaccion = {
				timestamp: new Date(),
				error: {
					source: 'SAP',
					statusCode: respuestaSap.statusCode,
					message: respuestaSap.statusMessage
				}
			}
		} else { // Respuesta correcta de SAP
			respuestaSapTransaccion = {
				timestamp: new Date(),
				statusCode: respuestaSap.statusCode,
				headers: respuestaSap.headers,
				body: respuestaSap.body
			}
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

module.exports.errorConfirmacionPedido = (req, res, cuerpoRespuesta, estado) => {

	let txId = req.txId;
	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONFIRMACION_PEDIDO, estado)

	L.xi(txId, ['Emitiendo COMMIT para evento ErrorConfirmacionPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.CONFIRMACION_PEDIDO, estado, [req.body]);
}

module.exports.confirmacionPedido = (req, txIdConfirmado, estadoTransmisionConfirmada, datosExtra) => {

	let txId = req.txId;
	if (!datosExtra) datosExtra = {};

	// NOTA: esta transacción no tiene "evento de cierre", es decir, no guardamos la respuesta que le damos a SAP porque es completamente irrelevante.
	let transaccion = iEventosComun.generarEventoDeApertura(req, K.TX_TYPES.CONFIRMACION_PEDIDO, K.TX_STATUS.OK)
	transaccion['$set'].confirmingId = txIdConfirmado;


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
			numerosPedidoSAP: datosExtra.numerosPedidoSAP
		},
		$push:{
			sapConfirms: {
				txId: txId,
				timestamp: new Date(),
				sapSystem: req.identificarUsuarioAutenticado()
			}
		}
	}

	L.xi(txId, ['Emitiendo COMMIT para evento ConfirmacionPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	iMongo.transaccion.grabar(transaccionActualizacionConfirmada);

	L.evento(txIdConfirmado, K.TX_TYPES.CONFIRMACION_PEDIDO, estadoTransmisionConfirmada, datosExtra.numerosPedidoSAP);
}
