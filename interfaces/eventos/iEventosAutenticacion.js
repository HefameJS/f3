'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const clone = require('clone');

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iFlags = require(BASE + 'interfaces/iFlags');


module.exports.inicioAutenticacion = (req) => {

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
			authenticatingUser: req.identificarUsuarioAutenticado(),
			iid: global.instanceID,
			type: K.TX_TYPES.AUTENTICACION,
			clientRequest: {
				ip: req.originIp,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: clone(req.body) // Clone necesario para poder eliminar la password mas adelante
			}
		}
	}

	// Ocultamos la contraseña del usuario en los logs
	if (transaccion['$set'].clientRequest.body.password) 
		transaccion['$set'].clientRequest.body.password = '******';

	L.xi(txId, ['Emitiendo COMMIT para evento AuthRequest'], 'txCommit');
	iMongo.transaccion.grabarEnMemoria(transaccion);
}

module.exports.finAutenticacion = (res, cuerpoRespuesta, status) => {

	let txId = res.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: status,
		},
		$set: {
			clientResponse: {
				timestamp: new Date(),
				status: res.statusCode,
				headers: res.getHeaders(),
				body: cuerpoRespuesta
			}
		}
	}

	iFlags.finaliza(txId, transaccion);

	
	L.xi(txId, ['Emitiendo COMMIT para evento AuthResponse'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
}
