'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');

// Modelos
const ObjectID = iMongo.ObjectID;


module.exports.inicioDevolucion = (req, devolucion) => {
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
	iMongo.transaccion.grabarEnMemoria(reqData);
	L.yell(req.txId, K.TX_TYPES.DEVOLUCION, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), devolucion.crc, req.body]);
}
module.exports.finDevolucion = (res, responseBody, status, extra) => {

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
	iMongo.transaccion.grabar(resData);
	L.yell(res.txId, K.TX_TYPES.DEVOLUCION, status, [responseBody]);
}
module.exports.errorDevolucion = (req, res, responseBody, status) => {

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
	iMongo.transaccion.grabar(data);
	L.yell(req.txId, K.TX_TYPES.DEVOLUCION, status, [req.identificarUsuarioAutenticado(), responseBody]);
}
module.exports.consultaDevolucion = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estadoFinal
		},
		$set: {
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			devolucionConsultada: req.query.numeroDevolucion || req.params.numeroDevolucion,
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
				body: cuerpoRespuesta
			}
		}
	}

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA DEVOLUCION'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
}

