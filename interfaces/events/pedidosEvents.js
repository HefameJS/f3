'use strict';
const BASE = global.BASE;
const L = global.logger;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/txTypes');
const txStatus = require(BASE + 'model/txStatus');

function identifyAuthenticatingUser(req) {
	if (req && req.token && req.token.sub) {
		return req.token.sub;
	}
	return undefined;
}

function identifyClient(req) {
	if (req && req.body && req.body.codigoCliente) {
		return req.body.codigoCliente;
	}
	return undefined;
}



module.exports.emitPedidoDuplicado = function (req, res, responseBody, originalTx) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			type: txTypes.PEDIDO_DUPLICADO,
			status: txStatus.DUPLICADO,
			originalTx: originalTx._id,
			iid: global.instanceID,
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	var dataUpdate = {
		$setOnInsert: {
			_id: originalTx._id,
			createdAt: new Date()
		},
		$push: {
			duplicates: data['$setOnInsert']
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento PedidoDuplicado', data, dataUpdate['$push'].duplicates], 'txCommit');
	Imongo.commit(dataUpdate);
	Imongo.commit(data);
}

module.exports.emitErrorConsultarPedido = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID
		},
		$set: {
			pedidoConsultado: req.query.numeroPedido || req.params.numeroPedido,
			modifiedAt: new Date(),
			type: txTypes.CONSULTAR_PEDIDO,
			status: status,
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorConsultarPedido', data['$set']], 'txCommit');
	Imongo.commit(data);
}
module.exports.emitRequestConsultarPedido = function(req) {
	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: txStatus.RECEPCIONADO,
			authenticatingUser: identifyAuthenticatingUser(req),
			iid: global.instanceID
		},
		$set: {
			pedidoConsultado: req.query.numeroPedido || req.params.numeroPedido,
			modifiedAt: new Date(),
			type: txTypes.CONSULTAR_PEDIDO,
			clientRequest: {
				authentication: req.token,
      		ip: req.ip,
      		protocol: req.protocol,
      		method: req.method,
      		url: req.originalUrl,
      		route: req.route.path,
      		headers: req.headers,
      		body: req.body
			}
		}
	};

	L.xi(req.txId, ['Emitiendo COMMIT para evento RequestPedido', reqData['$set']], 'txCommit');
	Imongo.commit(reqData);
}
module.exports.emitResponseConsultarPedido = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: {
			_id: res.txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
			status: status,
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento PedQueryRes', resData['$set']], 'txCommit');
	Imongo.commit(resData);
}

module.exports.emitErrorCrearPedido = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.CREAR_PEDIDO,
			status: status,
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento emitErrorCrearPedido', data['$set']], 'txCommit');
	Imongo.commit(data);
}
module.exports.emitRequestCrearPedido = function(req, pedido) {
	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			crc: new ObjectID(pedido.crc),
			createdAt: new Date(),
			status: txStatus.RECEPCIONADO,
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.CREAR_PEDIDO,
			clientRequest: {
				authentication: req.token,
      		ip: req.ip,
      		protocol: req.protocol,
      		method: req.method,
      		url: req.originalUrl,
      		route: req.route.path,
      		headers: req.headers,
      		body: req.body
			}
		}
	};

	L.xi(req.txId, ['Emitiendo COMMIT para evento PedReq', reqData['$set']], 'txCommit');
	Imongo.commit(reqData);
}
module.exports.emitResponseCrearPedido = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: { _id: res.txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			status: status,
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento PedRes', resData['$set']], 'txCommit');
	Imongo.commit(resData);
}
