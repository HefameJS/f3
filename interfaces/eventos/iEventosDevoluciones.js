'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iFlags');

// Modelos
const ObjectID = iMongo.ObjectID;


module.exports.inicioDevolucion = (req, devolucion) => {
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

	L.xi(txId, ['Emitiendo COMMIT para evento InicioCrearDevolucion'], 'txCommit');
	iMongo.transaccion.grabarEnMemoria(transaccion);
	L.evento(txId, K.TX_TYPES.DEVOLUCION, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), devolucion.crc, req.body]);
}
module.exports.finDevolucion = (res, cuerpoRespuesta, estadoFinal, datosExtra) => {

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
			numerosDevolucion: datosExtra.numerosDevolucion || [],
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: cuerpoRespuesta
			}
		}
	}

	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento FinCrearDevolucion'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.DEVOLUCION, estadoFinal, [cuerpoRespuesta]);
}
module.exports.errorDevolucion = (req, res, cuerpoRespuesta, status) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
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
				body: cuerpoRespuesta
			}
		}
	}

	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento ErrorCrearDevolucion'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.DEVOLUCION, status, [req.identificarUsuarioAutenticado(), cuerpoRespuesta]);
}
module.exports.devolucionDuplicada = (req, res, cuerpoRespuesta, txIdOriginal) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date(),
			type: K.TX_TYPES.DEVOLUCION_DUPLICADA,
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

	// Establece flags que hubiera en la transaccion actual (la de type: K.TX_TYPES.PEDIDO_DUPLICADO)
	iFlags.finaliza(txId, transaccion);

	// Establece el flag 'DUPLICADOS' en la transaccion original
	iFlags.set(txIdOriginal, K.FLAGS.DUPLICADOS);
	iFlags.finaliza(txIdOriginal, transaccionActualizacionOriginal);


	L.xi(txId, ['Emitiendo COMMIT para evento DevolucionDuplicada'], 'txCommit');
	iMongo.transaccion.grabar(transaccionActualizacionOriginal);
	iMongo.transaccion.grabar(transaccion);
}


