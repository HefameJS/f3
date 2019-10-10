'use strict';
const BASE = global.BASE;
const L = global.logger;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');


function identifyAuthenticatingUser(req) {
	if (req && req.token && req.token.sub) {
		return req.token.sub;
	}
	return undefined;
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

	var pedidoAgrupado = (body && body.numeropedido) ? body.numeropedido : undefined;

	var numerosPedidoSAP = undefined;
	if (body && body.sap_pedidosasociados) {
		if (body.sap_pedidosasociados.push) numerosPedidoSAP = body.sap_pedidosasociados;
		else numerosPedidoSAP = [body.sap_pedidosasociados];
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
		if (req.body.sap_pedidosasociados.push) numerosPedidoSAP = req.body.sap_pedidosasociados;
		else numerosPedidoSAP = [req.body.sap_pedidosasociados];
	}

	var updateData = {
		$setOnInsert: {
			_id: originalTx._id,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: txStatus.OK
		},
		$set: {
			numerosPedidoSAP: numerosPedidoSAP
		},
		$push:{
			sapConfirms: {
				txId: req.txId,
				timestamp: new Date(),
				sapSystem: identifyAuthenticatingUser(req),
				body: confirmTxBody
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento ConfirmacionPedido'], 'txCommit');
	Imongo.commit(reqData);
	Imongo.commit(updateData);

	// L.yell(req.txId, txTypes.CONFIRMACION_PEDIDO, txStatus.OK, [confirmTxBody]);
	L.yell(originalTx._id, txTypes.CONFIRMACION_PEDIDO, txStatus.OK, numerosPedidoSAP);
}
