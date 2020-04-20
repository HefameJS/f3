'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iFlags = require(BASE + 'interfaces/iFlags');

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

module.exports.logisticaDuplicado = (req, res, cuerpoRespuesta, idTxOriginal) => {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			type: K.TX_TYPES.LOGISTICA_DUPLICADA,
			status: K.TX_STATUS.OK,
			originalTx: idTxOriginal,
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
				body: cuerpoRespuesta
			},
		}
	}

	var dataUpdate = {
		$setOnInsert: {
			_id: idTxOriginal,
			createdAt: new Date()
		},
		$push: {
			duplicates: {
				_id: req.txId,
				timestamp: new Date()
			}
		}
	}

	iFlags.set(req.txId, K.FLAGS.DUPLICADOS);
	iFlags.finaliza(res.txId, dataUpdate);

	L.xi(req.txId, ['Emitiendo COMMIT para evento LogisticaDuplicado'], 'txCommit');
	iMongo.transaccion.grabar(dataUpdate);
	iMongo.transaccion.grabar(data);
}

module.exports.consultaLogistica = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroLogistica = (req.query ? req.query.numeroLogistica : null) || (req.params ? req.params.numeroLogistica : null) || null;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max : {
			status: estadoFinal,
			modifiedAt: new Date()
		},
		$set: {
			authenticatingUser: req.identificarUsuarioAutenticado(),
			iid: global.instanceID,
			type: K.TX_TYPES.CONSULTA_LOGISTICA,
			numeroLogistica: numeroLogistica,
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
				body: cuerpoRespuesta
			}
		}
	}

	L.xi(txId, ['Emitiendo COMMIT para evento consultaLogistica'], 'txCommit');
	console.log(transaccion);
	iMongo.transaccion.grabar(transaccion);
}