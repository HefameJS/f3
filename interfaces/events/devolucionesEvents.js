'use strict';
const BASE = global.BASE;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/txTypes');
const txStatus = require(BASE + 'model/txStatus');


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
}
module.exports.emitDevolucionDuplicada = function (req, res, responseBody, originalTx) {

	var data = {
		$setOnInsert: {
			_id: originalTx._id,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date()
		},
		$push: {
			duplicates: {
				iid: global.instanceID,
				timestamp: new Date(),
				clientRequest: {
					authentication: req.token,
					ip: req.ip,
					protocol: req.protocol,
					method: req.method,
					url: req.originalUrl,
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
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento DevolucionDuplicada', data['$push'].duplicates], 'txCommit');
	Imongo.commit(data);
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
}
module.exports.emitResponseDevolucion = function (res, responseBody, status) {
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

	L.xi(res.txId, ['Emitiendo COMMIT para evento ResponseDevolucion', resData['$set']], 'txCommit');
	Imongo.commit(resData);
}
