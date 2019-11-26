'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');
const saneaPedidosAsociadosSap = require(BASE + 'util/saneaPedidosAsociados');

function identifyAuthenticatingUser(req) {
	if (req && req.token && req.token.sub) {
		return req.token.sub;
	}
	return undefined;
}


module.exports.emitRequestToSap = (txId, callParams) => {
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
			crc: (callParams.body && callParams.body.crc) ? new ObjectID(callParams.body.crc) : undefined,
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
	Imongo.buffer(data);
}

module.exports.emitResponseFromSap = (txId, callError, sapHttpResponse) => {
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
	Imongo.buffer(data);
}

module.exports.emitSapRequest = function (txId, url, req) {
	var data = {
      $setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: txStatus.ESPERANDO_INCIDENCIAS
		},
		$set: {
      	sapRequest: {
				timestamp: new Date(),
				method: req.method,
				headers: req.headers,
				body: req.body,
				url: url
			}
		}
	}

	if (req.body.crc) data['$set'].crc = new ObjectID(req.body.crc);

	L.xi(txId, ['Emitiendo BUFFER para evento SapRequest'], 'txBuffer');
	Imongo.buffer(data);
}

module.exports.emitSapResponse = function (txId, res, body, error) {
	var statusCodeType = ( (res && res.statusCode) ? Math.floor(res.statusCode / 100) : 0);
	var sapResponse;

	if (error) { // Error de RED
		sapResponse = {
			timestamp: new Date(),
			error: {
				source: 'NET',
				statusCode: error.errno || false,
				message: error.message
			}
		}
	} else if (statusCodeType !== 2) { // Error de SAP
		sapResponse = {
			timestamp: new Date(),
			error: {
				source: 'SAP',
				statusCode: res.statusCode,
				message: res.statusMessage
			}
		}
	} else {
		sapResponse = {
			timestamp: new Date(),
			statusCode: res.statusCode,
			headers: res.headers,
			body: body
		}
	}

	var pedidoAgrupado = undefined;
	var numerosPedidoSAP = undefined;

	if (body) {
		pedidoAgrupado = (body.numeropedido) ? body.numeropedido : undefined;
		numerosPedidoSAP = saneaPedidosAsociadosSap(body.sap_pedidosasociados);
	}

	var data = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
    		status: txStatus.INCIDENCIAS_RECIBIDAS
		},
		$set: {
			pedidoAgrupado: pedidoAgrupado,
			numerosPedidoSAP: numerosPedidoSAP,
    		sapResponse: sapResponse
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento SapResponse'], 'txBuffer');
   Imongo.buffer(data);
}


module.exports.emitErrorConfirmacionPedido = function (req, res, responseBody, status) {

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: status,
			iid: global.instanceID,
			authenticatingUser: identifyAuthenticatingUser(req),
			type: txTypes.CONFIRMACION_PEDIDO,
			clientRequest: {
				authentication: req.token,
				ip: req.originIp,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			},
			clientResponse: {
				timestamp: new Date(),
				status: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorConfirmacionPedido'], 'txCommit');
	Imongo.commit(reqData);
	L.yell(req.txId, txTypes.CONFIRMACION_PEDIDO, status, [req.body]);
}
module.exports.emitConfirmacionPedido = function (req, res, confirmTxBody, originalTx) {

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: txStatus.OK,
			iid: global.instanceID,
			authenticatingUser: identifyAuthenticatingUser(req),
			confirmingId: originalTx._id,
			type: txTypes.CONFIRMACION_PEDIDO,
			clientRequest: {
				authentication: req.token,
				ip: req.originIp,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			},
			clientResponse: {
				timestamp: new Date(),
				status: res.statusCode,
				headers: res.getHeaders(),
				body: confirmTxBody
			}
		}
	}

	var numerosPedidoSAP = undefined;
	if (req.body && req.body.sap_pedidosasociados) {
		numerosPedidoSAP = saneaPedidosAsociadosSap(req.body.sap_pedidosasociados);
	}

	var updatedTxStatus = numerosPedidoSAP ? txStatus.OK : txStatus.SIN_NUMERO_PEDIDO_SAP;

	var updateData = {
		$setOnInsert: {
			_id: originalTx._id,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: updatedTxStatus
		},
		$set: {
			numerosPedidoSAP: numerosPedidoSAP || []
		},
		$push:{
			sapConfirms: {
				txId: req.txId,
				timestamp: new Date(),
				sapSystem: identifyAuthenticatingUser(req)
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento ConfirmacionPedido'], 'txCommit');
	Imongo.commit(reqData);
	Imongo.commit(updateData);

	// L.yell(req.txId, txTypes.CONFIRMACION_PEDIDO, txStatus.OK, [confirmTxBody]);
	L.yell(originalTx._id, txTypes.CONFIRMACION_PEDIDO, updatedTxStatus, numerosPedidoSAP);
}
