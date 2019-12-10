'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;


module.exports.emitDevolucionDuplicada = (req, res, responseBody, originalTxId) => {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			type: K.TX_TYPES.DEVOLUCION_DUPLICADA,
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
			}
		}
	}

	var dataUpdate = {
		$setOnInsert: {
			_id: originalTxId,
			createdAt: new Date()
		},
		$push: {
			duplicates: {
				_id: req.txId,
				timestamp: new Date()
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento DevolucionDuplicada'], 'txCommit');
	Imongo.commit(dataUpdate);
	Imongo.commit(data);
}
module.exports.emitErrorCrearDevolucion = (req, res, responseBody, status) => {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			modifiedAt: new Date(),
			type: K.TX_TYPES.DEVOLUCION,
			status: status,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorCrearDevolucion'], 'txCommit');
	Imongo.commit(data);
	L.yell(req.txId, K.TX_TYPES.DEVOLUCION, status, [req.identificarUsuarioAutenticado(), responseBody]);
}
module.exports.emitInicioCrearDevolucion = (req, devolucion) => {
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
			crc: new ObjectID(devolucion.crc),
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			type: K.TX_TYPES.DEVOLUCION,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento InicioCrearDevolucion'], 'txCommit');
	Imongo.buffer(reqData);
	L.yell(req.txId, K.TX_TYPES.DEVOLUCION, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), devolucion.crc, req.body]);
}
module.exports.emitFinCrearDevolucion = (res, responseBody, status, extra) => {

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
			numerosDevolucion: extra.numerosDevolucion || [],
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento FinCrearDevolucion'], 'txCommit');
	Imongo.commit(resData);
	L.yell(res.txId, K.TX_TYPES.DEVOLUCION, status, [responseBody]);
}


module.exports.emitErrorConsultarDevolucion = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: {
			_id: res.txId,
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
			pedidoConsultado: req.query.numeroDevolucion || req.params.numeroDevolucion,
			type: K.TX_TYPES.CONSULTA_DEVOLUCION,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorConsultarDevolucion'], 'txCommit');
	Imongo.commit(data);
}
module.exports.emitRequestConsultarDevolucion = function(req) {
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
			pedidoConsultado: req.query.numeroDevolucion || req.params.numeroDevolucion,
			type: K.TX_TYPES.CONSULTA_DEVOLUCION,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento RequestConsultarDevolucion'], 'txCommit');
	Imongo.buffer(reqData);
}
module.exports.emitResponseConsultarDevolucion = function (res, responseBody, status) {
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

	L.xi(res.txId, ['Emitiendo COMMIT para evento ResponseConsultarDevolucion'], 'txCommit');
	Imongo.commit(resData);
}
