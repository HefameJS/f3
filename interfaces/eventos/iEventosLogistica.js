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

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
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

	L.xi(txId, ['Emitiendo COMMIT para evento inicioLogistica'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.yell(txId, K.TX_TYPES.LOGISTICA, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), logistica.crc, req.body]);
}

module.exports.finLogistica = (res, cuerpoRespuesta, estadoFinal, datosExtra) => {

	let txId = res.txId;
	if (!datosExtra) datosExtra = {}

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
			numeroLogistica: datosExtra.numeroLogistica || null,
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: cuerpoRespuesta
			}
		}
	}

	L.xi(txId, ['Emitiendo COMMIT para evento finLogistica'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.yell(txId, K.TX_TYPES.LOGISTICA, estadoFinal, [cuerpoRespuesta]);
}

module.exports.errorLogistica = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date(),
			authenticatingUser: req.identificarUsuarioAutenticado(),
			client: req.identificarClienteSap(),
			iid: global.instanceID,
			modifiedAt: new Date(),
			type: K.TX_TYPES.LOGISTICA,
			status: estadoFinal,
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

	L.xi(txId, ['Emitiendo COMMIT para evento errorLogistica'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.yell(txId, K.TX_TYPES.LOGISTICA, estadoFinal, [req.identificarUsuarioAutenticado(), cuerpoRespuesta]);
}

module.exports.logisticaDuplicado = (req, res, cuerpoRespuesta, txIdOriginal) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date(),
			type: K.TX_TYPES.LOGISTICA_DUPLICADA,
			status: K.TX_STATUS.OK,
			originalTx: txIdOriginal,
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

	let transaccionActualizacionOriginal = {
		$setOnInsert: {
			_id: txIdOriginal,
			createdAt: new Date()
		},
		$push: {
			duplicates: {
				_id: txId,
				timestamp: new Date()
			}
		}
	}

	iFlags.set(txId, K.FLAGS.DUPLICADOS);
	iFlags.finaliza(txId, transaccionActualizacionOriginal);

	L.xi(txId, ['Emitiendo COMMIT para evento LogisticaDuplicado'], 'txCommit');
	iMongo.transaccion.grabar(transaccionActualizacionOriginal);
	iMongo.transaccion.grabar(transaccion);
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