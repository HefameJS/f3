
const config = global.config;
const FedicomError = require('../model/fedicomError');

const L = global.logger;


module.exports.encrypt = function (text) {
  var crypto = require('crypto');
  var cipher = crypto.createCipher('aes-256-ctr', config.jwt.password_encryption_key);
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}
module.exports.decrypt = function(text) {
  var crypto = require('crypto');
  var decipher = crypto.createDecipher('aes-256-ctr', config.jwt.password_encryption_key);
  var dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}


module.exports.generateJWT = function(authReq, jti,  includePassword) {
	var jwt = require('jsonwebtoken');
	var jwtData = {
		iss: 'HEFAME@' + require('os').hostname(),
		sub: authReq.username,
		aud: authReq.domain,
		exp: Date.timestamp() + (1000 * 60 * (config.jwt.token_lifetime_minutes || 30)),
		iat: Date.timestamp(),
		jti: jti
	};

	if (includePassword) {
		jwtData.cyp = module.exports.encrypt(authReq.password);
	}

	var token = jwt.sign(jwtData, config.jwt.token_signing_key);
	L.xi(jti, ['Generado JWT', token, jwtData], 'jwt');
	return token;
}


module.exports.verifyJWT = function(token, txId) {

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
		var decoded = jwt.verify(token, config.jwt.token_signing_key);
		var meta = {};

		if (decoded.exp) {
			var diff = Date.timestamp() - decoded.exp;
			if (diff > ( (config.jwt.token_validation_skew_clock_seconds || 10) * 1000) ) {
				L.xd(txId, ['Se rechaza porque el token está caducado por ' + diff + 'ms'], 'txToken');
				// TOKEN CADUCADO
				meta = {
					ok: false,
					error: 'Token caducado',
					exception: new FedicomError('AUTH-001', 'Usuario no autentificado', 401)
				}
			} else {
				// TOKEN OK
				if (decoded.cyp) {
					L.xd(txId, ['El token es correcto, pero no se verificó en SAP'], 'txToken');
					meta = {
						ok: true,
						verified: false,
						pwd:  module.exports.decrypt(decoded.cyp)
					}
				} else {
					meta = {
						ok: true,
						verified: true
					}
				}
      	}
		} else {
			// ¿No contiene campo 'exp'? ESTO ES UN FAKE
			L.xd(txId, ['El token no contiene el campo EXP, esto es un ataque.'], 'txToken');
	      meta = {
				ok: false,
				error: 'Token incompleto',
				exception: new FedicomError('AUTH-002', 'Token inválido', 401)
			}
		}
		decoded.meta = meta;
		return decoded;

	} catch(err) {

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
