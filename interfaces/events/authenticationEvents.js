'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;


const clone = require('clone');
const Imongo = require(BASE + 'interfaces/imongo');
const Flags = require(BASE + 'interfaces/cache/flags');

module.exports.emitAuthRequest = function (req) {

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
	if (reqData['$set'].clientRequest.body.password) reqData['$set'].clientRequest.body.password = '******';

	L.xi(req.txId, ['Emitiendo COMMIT para evento AuthRequest'], 'txCommit');
	Imongo.buffer(reqData);
}
module.exports.emitAuthResponse = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: {
			_id: res.txId,
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
				body: responseBody
			},
			flags: Flags.fin(res.txId)
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento AuthResponse'], 'txCommit');
	Imongo.commit(resData);
}
