'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

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

function identifyClient(req) {
	if (req && req.body && req.body.codigoCliente) {
		return req.body.codigoCliente;
	}
	return undefined;
}

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
	L.yell(req.txId, txTypes.DEVOLUCION_DUPLICADA, txStatus.DUPLICADO, [originalTxId]);
}

module.exports.emitErrorCrearDevolucion = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID,
			modifiedAt: new Date(),
			type: txTypes.CREAR_DEVOLUCION,
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
	L.yell(req.txId, txTypes.CREAR_DEVOLUCION, status, [identifyAuthenticatingUser(req), responseBody]);
}
module.exports.emitRequestDevolucion = function(req, devolucion) {
	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: txStatus.RECEPCIONADO
		},
		$set: {
			crc: new ObjectID(devolucion.crc),
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID,
			type: txTypes.CREAR_DEVOLUCION,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento RequestDevolucion'], 'txCommit');
	Imongo.buffer(reqData);
	L.yell(req.txId, txTypes.CREAR_DEVOLUCION, txStatus.RECEPCIONADO, [identifyAuthenticatingUser(req), devolucion.crc, req.body]);
}
module.exports.emitResponseDevolucion = function (res, responseBody, status) {

	var numerosDevolucion = [];
	if (responseBody && responseBody.length > 0) {
		responseBody.forEach( function (devolucion) {
			if (devolucion && devolucion.numeroDevolucion) {
					numerosDevolucion.push(devolucion.numeroDevolucion);
			}
		});
	}

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
			numerosDevolucion: numerosDevolucion,
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento ResponseDevolucion'], 'txCommit');
	Imongo.commit(resData);
	L.yell(res.txId, txTypes.CREAR_DEVOLUCION, status, [responseBody]);
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
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID,
			pedidoConsultado: req.query.numeroDevolucion || req.params.numeroDevolucion,
			type: txTypes.CONSULTAR_DEVOLUCION,
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
			status: txStatus.RECEPCIONADO
		},
		$set: {
			authenticatingUser: identifyAuthenticatingUser(req),
			iid: global.instanceID,
			pedidoConsultado: req.query.numeroDevolucion || req.params.numeroDevolucion,
			type: txTypes.CONSULTAR_DEVOLUCION,
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
