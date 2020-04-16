'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');

module.exports.incioLlamadaSap = (txId, callParams) => {

	var data = {
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
				method: callParams.method,
				headers: callParams.headers,
				body: callParams.body,
				url: callParams.url
			}
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento RequestToSap'], 'txBuffer');
	iMongo.transaccion.grabarEnMemoria(data);
}

module.exports.finLlamadaSap = (txId, callError, sapHttpResponse) => {
	var sapResponse = {};
	if (callError) { // Error de RED
		sapResponse = {
			timestamp: new Date(),
			error: {
				source: 'NET',
				statusCode: callError.errno || false,
				message: callError.message || 'Sin descripción del error'
			}
		}
	} else {
		if (sapHttpResponse.errorSap) { // Error de SAP
			sapResponse = {
				timestamp: new Date(),
				error: {
					source: 'SAP',
					statusCode: sapHttpResponse.statusCode,
					message: sapHttpResponse.statusMessage
				}
			}
		} else { // Respuesta correcta de SAP
			sapResponse = {
				timestamp: new Date(),
				statusCode: sapHttpResponse.statusCode,
				headers: sapHttpResponse.headers,
				body: sapHttpResponse.body
			}
		}
	}

	var data = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.INCIDENCIAS_RECIBIDAS
		},
		$set: {
			sapResponse: sapResponse
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento ResponseFromSap'], 'txBuffer');
	iMongo.transaccion.grabarEnMemoria(data);
}

module.exports.errorConfirmacionPedido = function (req, status) {

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: status,
			iid: global.instanceID,
			authenticatingUser: req.identificarUsuarioAutenticado(),
			type: K.TX_TYPES.CONFIRMACION_PEDIDO,
			clientRequest: {
				authentication: req.token,
				ip: req.originIp,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorConfirmacionPedido'], 'txCommit');
	iMongo.transaccion.grabar(reqData);
	L.yell(req.txId, K.TX_TYPES.CONFIRMACION_PEDIDO, status, [req.body]);
}

module.exports.confirmacionPedido = function (req, originalTxId, updatedTxStatus, extra) {
	if (!extra) extra = {};

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: K.TX_STATUS.OK,
			iid: global.instanceID,
			authenticatingUser: req.identificarUsuarioAutenticado(),
			confirmingId: originalTxId,
			type: K.TX_TYPES.CONFIRMACION_PEDIDO,
			clientRequest: {
				authentication: req.token,
				ip: req.originIp,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			}
		}
	}

	var updateData = {
		$setOnInsert: {
			_id: originalTxId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: updatedTxStatus
		},
		$set: {
			numerosPedidoSAP: extra.numerosPedidoSAP
		},
		$push:{
			sapConfirms: {
				txId: req.txId,
				timestamp: new Date(),
				sapSystem: req.identificarUsuarioAutenticado()
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento ConfirmacionPedido'], 'txCommit');
	iMongo.transaccion.grabar(reqData);
	iMongo.transaccion.grabar(updateData);

	L.yell(originalTxId, K.TX_TYPES.CONFIRMACION_PEDIDO, updatedTxStatus, extra.numerosPedidoSAP);
}
