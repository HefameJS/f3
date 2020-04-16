'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');

// Modelos
const ObjectID = iMongo.ObjectID;


module.exports.inicioLogistica = (req, logistica) => {
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
			crc: new ObjectID(logistica.crc),
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			type: K.TX_TYPES.LOGISTICA,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento inicioLogistica'], 'txCommit');
	iMongo.transaccion.grabar(reqData);
	L.yell(req.txId, K.TX_TYPES.LOGISTICA, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), logistica.crc, req.body]);
}

module.exports.finLogistica = (res, responseBody, status, extra) => {

	if (!extra) extra = {}

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
			numeroLogistica: extra.numeroLogistica || null,
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento finLogistica'], 'txCommit');
	iMongo.transaccion.grabar(resData);
	L.yell(res.txId, K.TX_TYPES.LOGISTICA, status, [responseBody]);
}

module.exports.errorLogistica = (req, res, responseBody, status) => {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			modifiedAt: new Date(),
			type: K.TX_TYPES.LOGISTICA,
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

	L.xi(req.txId, ['Emitiendo COMMIT para evento errorLogistica'], 'txCommit');
	iMongo.transaccion.grabar(data);
	L.yell(req.txId, K.TX_TYPES.LOGISTICA, status, [req.identificarUsuarioAutenticado(), responseBody]);
}


module.exports.consultaLogistica = function (req, res, responseBody, status) {

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
			iid: global.instanceID,
			numeroLogistica: req.query.numeroLogistica || req.params.numeroLogistica || null,
			type: K.TX_TYPES.CONSULTA_LOGISTICA,
			clientRequest: {
				authentication: req.token,
				ip: req.originIp,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
			},
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento consultaLogistica'], 'txCommit');
	iMongo.transaccion.grabar(data);
}