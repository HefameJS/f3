'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');



module.exports.generateJWT = (txId, authReq, perms) => {
	var jwt = require('jsonwebtoken');
	var jwtData = {
		sub: authReq.username,
		aud: authReq.domain,
		exp: Math.ceil(Date.fedicomTimestamp() / 1000) + (60 * (C.jwt.token_lifetime_minutes || 30)),
		jti: txId
	};

	if (perms && perms.forEach) jwtData.perms = perms

	var token = jwt.sign(jwtData, C.jwt.token_signing_key);
	L.xi(txId, ['Generado JWT', token, jwtData], 'jwt');
	return token;
}


module.exports.verifyJWT = (token, txId) => {

	L.xd(txId, ['Analizando token', token], 'txToken');

	if (!token) {
		L.xd(txId, ['Se rechaza porque no hay token'], 'txToken');
		return {
			meta: {
				ok: false,
				error: 'No se especifica token',
				exception: new FedicomError('AUTH-002', 'Token inválido', 401)
			}
		}
	}

	var jwt = require('jsonwebtoken');
	try {
		var decoded = jwt.verify(token, C.jwt.token_signing_key);
		var meta = {};

		if (decoded.exp) {
			var diff = (Date.fedicomTimestamp() / 1000) - decoded.exp;
			if (diff > ((C.jwt.token_validation_skew_clock_seconds || 10))) {
				L.xd(txId, ['Se rechaza porque el token está caducado por ' + diff + 'ms'], 'txToken');
				// TOKEN CADUCADO
				meta = {
					ok: false,
					error: 'Token caducado',
					exception: new FedicomError('AUTH-001', 'Usuario no autentificado', 401)
				}
			} else {
				// TOKEN OK
				meta = {
					ok: true,
					verified: true
				}
			}
		} else {
			// ¿No contiene campo 'exp'? ESTO ES UN FAKE
			L.xe(txId, ['El token no contiene el campo EXP !!'], 'txToken');
			meta = {
				ok: false,
				error: 'Token incompleto',
				exception: new FedicomError('AUTH-002', 'Token inválido', 401)
			}
		}
		decoded.meta = meta;
		return decoded;

	} catch (err) {

		L.xd(txId, ['Se rechaza porque el token es invalido', err], 'txToken');
		return {
			meta: {
				ok: false,
				error: err.message,
				exception: new FedicomError('AUTH-002', 'Token inválido', 401)
			}
		};
	}
}
