'use strict';
const BASE = global.BASE;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');


const L = global.logger;

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

module.exports.emitDevolucionDuplicada = function (req, res, responseBody, originalTx) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			type: txTypes.DEVOLUCION_DUPLICADA,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento DevolucionDuplicada', data, dataUpdate['$push'].duplicates], 'txCommit');
	Imongo.commit(dataUpdate);
	Imongo.commit(data);
	L.yell(req.txId, txTypes.DEVOLUCION_DUPLICADA, txStatus.DUPLICADO, [originalTx._id]);
}

module.exports.emitErrorCrearDevolucion = function (req, res, responseBody, status) {

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
			type: txTypes.CREAR_DEVOLUCION,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento ErrorCrearDevolucion', data['$set']], 'txCommit');
	Imongo.commit(data);
	L.yell(req.txId, txTypes.CREAR_DEVOLUCION, status, [identifyAuthenticatingUser(req), responseBody]);
}
module.exports.emitRequestDevolucion = function(req, devolucion) {
	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			crc: new ObjectID(devolucion.crc),
			createdAt: new Date(),
			status: txStatus.RECEPCIONADO,
			authenticatingUser: identifyAuthenticatingUser(req),
			client: identifyClient(req),
			iid: global.instanceID
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.CREAR_DEVOLUCION,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento RequestDevolucion', reqData['$set']], 'txCommit');
	Imongo.commit(reqData);
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
		$setOnInsert: { _id: res.txId, createdAt: new Date() },
		$set: {
			numerosDevolucion: numerosDevolucion,
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

	L.xi(res.txId, ['Emitiendo COMMIT para evento ResponseDevolucion', resData['$set']], 'txCommit');
	Imongo.commit(resData);
	L.yell(res.txId, txTypes.CREAR_DEVOLUCION, status, [responseBody]);
}
