'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const Flags = require(BASE + 'interfaces/cache/flags');


module.exports.emitPedidoDuplicado = (req, res, responseBody, originalTxId) => {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			type: K.TX_TYPES.PEDIDO_DUPLICADO,
			status: K.TX_STATUS.OK,
			originalTx: originalTxId,
			iid: global.instanceID,
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			},
		}
	}

	var dataUpdate = {
		$setOnInsert: {
			_id: originalTxId,
			createdAt: new Date()
		},
		$set: {
			flags: {
				dupes: true
			}
		},
		$push: {
			duplicates: {
				_id: req.txId,
				timestamp: new Date()
			}
		}
	}

	Flags.finaliza(res.txId, resData);

	L.xi(req.txId, ['Emitiendo COMMIT para evento PedidoDuplicado'], 'txCommit');
	Imongo.commit(dataUpdate);
	Imongo.commit(data);
}

module.exports.emitErrorConsultarPedido = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: status
		},
		$set: {
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			pedidoConsultado: req.query.numeroPedido || req.params.numeroPedido,
			type: K.TX_TYPES.CONSULTA_PEDIDO,
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	Flags.finaliza(res.txId, resData);

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorConsultarPedido', data['$set']], 'txCommit');
	Imongo.commit(data);
}
module.exports.emitRequestConsultarPedido = function(req) {
	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.RECEPCIONADO
		},
		$set: {
			authenticatingUser: req.identificarUsuarioAutenticado(),
			iid: global.instanceID,
			pedidoConsultado: req.query.numeroPedido || req.params.numeroPedido,
			type: K.TX_TYPES.CONSULTA_PEDIDO,
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
	};

	L.xi(req.txId, ['Emitiendo COMMIT para evento RequestConsultarPedido'], 'txCommit');
	Imongo.buffer(reqData);
}
module.exports.emitResponseConsultarPedido = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: {
			_id: res.txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: status
		},
		$set: {
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	Flags.finaliza(res.txId, resData);

	L.xi(res.txId, ['Emitiendo COMMIT para evento ResponseConsultarPedido'], 'txCommit');
	Imongo.commit(resData);
}


module.exports.emitInicioCrearPedido = (req, pedido) => {
	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.RECEPCIONADO
		},
		$set: {
			crc: new ObjectID(pedido.crc),
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			type: K.TX_TYPES.PEDIDO,
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
	};

	L.xi(req.txId, ['Emitiendo COMMIT para evento InicioCrearPedido'], 'txCommit');
	Imongo.commit(reqData);
	L.yell(req.txId, K.TX_TYPES.PEDIDO, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), pedido.crc, req.body]);
}
module.exports.emitFinCrearPedido = (res, responseBody, status, extra) => {
	if (!extra) extra = {};

	var resData = {
		$setOnInsert: {
			_id: res.txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: status,
		},
		$set: {
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			},
			numeroPedidoAgrupado: extra.numeroPedidoAgrupado || undefined,
			numerosPedidoSAP: extra.numerosPedidoSAP || []
		}
	}

	Flags.finaliza(res.txId, resData);

	L.xi(res.txId, ['Emitiendo COMMIT para evento ResponseCrearPedido'], 'txCommit');
	Imongo.commit(resData);
	L.yell(res.txId, K.TX_TYPES.PEDIDO, status, [responseBody]);
}
module.exports.emitErrorCrearPedido = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			modifiedAt: new Date(),
			status: status,
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			type: K.TX_TYPES.PEDIDO,
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}
	
	Flags.finaliza(res.txId, resData);

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorCrearPedido'], 'txCommit');
	Imongo.commit(data);
	L.yell(req.txId, K.TX_TYPES.PEDIDO, status, [req.identificarUsuarioAutenticado(), responseBody]);
}