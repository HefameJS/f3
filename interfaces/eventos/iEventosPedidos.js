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


module.exports.inicioPedido = (req, pedido) => {

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

	L.xi(txId, ['Emitiendo COMMIT para evento InicioCrearPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.yell(txId, K.TX_TYPES.PEDIDO, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), pedido.crc, req.body]);
}
module.exports.finPedido = (res, cuerpoRespuesta, estadoFinal, datosExtra) => {

	let txId = res.txId;
	if (!datosExtra) datosExtra = {};

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estadoFinal,
		},
		$set: {
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: cuerpoRespuesta
			},
			numeroPedidoAgrupado: datosExtra.numeroPedidoAgrupado || undefined,
			numerosPedidoSAP: datosExtra.numerosPedidoSAP || []
		}
	}

	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento FinCrearPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.yell(txId, K.TX_TYPES.PEDIDO, estadoFinal, [cuerpoRespuesta]);
}
module.exports.errorPedido = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date(),
			modifiedAt: new Date(),
			status: estadoFinal,
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
				body: cuerpoRespuesta
			}
		}
	}

	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento ErrorCrearPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.yell(txId, K.TX_TYPES.PEDIDO, estadoFinal, [req.identificarUsuarioAutenticado(), cuerpoRespuesta]);
}
module.exports.pedidoDuplicado = (req, res, cuerpoRespuesta, txIdOriginal) => {

	let txId = req.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date(),
			type: K.TX_TYPES.PEDIDO_DUPLICADO,
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

	L.xi(txId, ['Emitiendo COMMIT para evento PedidoDuplicado'], 'txCommit');
	iMongo.transaccion.grabar(transaccionActualizacionOriginal);
	iMongo.transaccion.grabar(transaccion);
}
module.exports.consultaPedido = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let numeroPedido = (req.query ? req.query.numeroPedido : null) || (req.params ? req.params.numeroPedido : null) || null;

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
			type: K.TX_TYPES.CONSULTA_PEDIDO,
			pedidoConsultado: numeroPedido,
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

	L.xi(txId, ['Emitiendo COMMIT para evento CONSULTA PEDIDO'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
}