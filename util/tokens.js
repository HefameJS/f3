'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');
const Flags = require(BASE + 'interfaces/cache/flags');



const generateJWT = (txId, authReq, perms) => {
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

const verifyJWT = (token, txId) => {

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

		// Comprobacion para levantar el flag de transfer
		if (decoded.sub && decoded.sub.search(/^T[RGP]/) === 0) {
			Flags.set(txId, K.FLAGS.TRANSFER);
		}

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

/**
 * Realiza la comprobación del token de la petición, pudiendo indicarse opciones de autorización.
 * Si el token no resultara válido, se retorna un error Fedicom3 al cliente con el error.
 * 
 * El método retorna un objeto tal que:
 * {
 * 		ok: booleano que indica si el token es válido o no
 * 		responseBody: Si el token no es válido, este es el cuerpo del mensaje enviado al cliente
 * 		status: Si el token no es válido, el estado en el que queda la transmisión [ FALLO_AUTENTICACION | ]
 * }
 * @param {*} req El objeto de petición HTTP entrante
 * @param {*} res El objeto de respuesta HTTP sobre el que enviar las respuestas de error, en caso de haberlo
 * @param {*} opciones Un objeto que permite indicar los dominios y/o permisos que el token debe tener.
 */
const validarTransmision = (req, res, opciones) => {

	let txId = req.txId

	/**
	 * Verificación básica de integridad y expiración del token
	 */
	req.token = verifyJWT(req.token, txId);
	if (req.token.meta.exception) {
		L.xe(txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		var responseBody = req.token.meta.exception.send(res);
		return { ok: false, responseBody, status: K.TX_STATUS.FALLO_AUTENTICACION };
	}

	/**
	 * Comprobamos que el dominio del token está en la lista de dominios permitidos
	 */
	let dominiosValidos = opciones.dominios || []
	if (dominiosValidos.length > 0) {
		if (!dominiosValidos.includes(req.token.aud)) {
			L.xe(txId, ['El dominio del token no es valido para realizar esta acción.', req.token, opciones], 'txToken');
			var error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			var responseBody = error.send(res);
			return { ok: false, responseBody, status: K.TX_STATUS.NO_AUTORIZADO };
		}
	}

	/**
	 * Comprobamos que el token contiene al menos uno de los permisos necesarios para la acción.
	 * Los permisos solo aplican en el caso de que el dominio sea HEFAME. Si el dominio no es HEFAME 
	 * y ha pasado la verificación de dominios permitidos, se acepta el token.
	 */
	let permisosNecesarios = opciones.permisos || []
	if (permisosNecesarios.length > 0 && req.token.aud === K.DOMINIOS.HEFAME) {
		if (req.token.perms.length > 0) {
			// Intersección entre la lista de permisos necesarios y los del token.
			// Si la intersección es vacía es que ninguno coincide y por tanto el token no vale
			let interseccion = permisosNecesarios.filter(value => req.token.perms.includes(value))	
			if (interseccion.length > 0) {
				return { ok: true }
			}
		}

		L.xe(txId, ['Los permisos del token no sos válidos para realizar esta acción.', req.token, opciones], 'txToken');
		var error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
		var responseBody = error.send(res);
		return { ok: false, responseBody, status: K.TX_STATUS.NO_AUTORIZADO };

	}

	return { ok: true }

}

module.exports = {
	generateJWT,
	verifyJWT,
	validarTransmision
}