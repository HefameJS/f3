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
		$set: {
			modifiedAt: new Date(),
      	status: txStatus.ESPERANDO_INCIDENCIAS,
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

	L.xi(txId, ['Emitiendo BUFFER para evento SapRequest', data['$set']], 'txBuffer');
	Imongo.buffer(data);
}
module.exports.emitSapResponse = function (txId, res, body, error) {
	var statusCodeType = ( (res && res.statusCode) ? Math.floor(res.statusCode / 100) : 0);
	var sapResponse;

	if (error) {
		sapResponse = {
			timestamp: new Date(),
			error: {
				source: 'NET',
				statusCode: error.errno || false,
				message: error.message
			}
		}
	} else if (statusCodeType !== 2) {
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

	var data = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
    		status: txStatus.INCIDENCIAS_RECIBIDAS,
    		sapResponse: sapResponse
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento SapResponse', data['$set']], 'txBuffer');
   Imongo.buffer(data);
}


module.exports.emitErrorConfirmacionPedido = function (req, res, responseBody, status) {

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: status,
			iid: global.instanceID,
			authenticatingUser: identifyAuthenticatingUser(req)
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.CONFIRMACION_PEDIDO,
			clientRequest: {
				authentication: req.token,
				ip: req.ip,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorConfirmacionPedido', reqData['$set']], 'txCommit');
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
			modifiedAt: new Date(),
			type: txTypes.CONFIRMACION_PEDIDO,
			clientRequest: {
				authentication: req.token,
				ip: req.ip,
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

	var numerosPedidoSAP = (confirmTxBody.numeropedido && confirmTxBody.numeropedido.push) ? confirmTxBody.numeropedido : (confirmTxBody.numeropedido ? [confirmTxBody.numeropedido] : undefined);
	var updateData = {
		$setOnInsert: {
			_id: originalTx._id
		},
		$set: {
			modifiedAt: new Date(),
			status: txStatus.OK,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento ConfirmacionPedido',
		reqData['$setOnInsert'],
		updateData['$set'],
		updateData['$push'],
		], 'txCommit');
	Imongo.commit(reqData);
	Imongo.commit(updateData);

	// L.yell(req.txId, txTypes.CONFIRMACION_PEDIDO, txStatus.OK, [confirmTxBody]);
	L.yell(originalTx._id, originalTx.type, txStatus.OK, numerosPedidoSAP);
}
