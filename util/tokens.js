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
 * Funcion que verifica los permisos del token de una petición entrante.
 * En caso de que el token no sea válido, responde a la petición.
 * 
 * La funcion devuelve un objeto donde siempre se incluirá la propiedad 'ok' con el resultado de la autenticacion.
 * Si el resultado es negativo, la respuesta también incluirá la propiedad 'responseBody' con la respuesta dada al cliente.
 * En el caso de simulaciones, la respuesta incluirá la propiedad 'usuarioSimulador' indicando el usuario que ordena la simulación.
 */
const DEFAULT_OPTS = {
	admitirSimulaciones: false,
	admitirSimulacionesEnProduccion: false,
	grupoRequerido: null
}
const verificaPermisos = (req, res, opciones) => {

	let txId = req.txId;

	opciones = { ...DEFAULT_OPTS, ...opciones }

	L.xt(txId, ['Verificando validez de token', req.token, opciones], 'txToken')

	req.token = verifyJWT(req.token, req.txId);
	if (req.token.meta.exception) {
		L.xe(req.txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		let responseBody = req.token.meta.exception.send(res);
		return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.FALLO_AUTENTICACION  };
	}

	// Si se indica la opcion grupoRequerido, es absolutamente necesario que el token lo incluya
	if (opciones.grupoRequerido) {
		if (!req.token.perms || !req.token.perms.includes(opciones.grupoRequerido)) {
			L.xw(req.txId, ['El token no tiene el permiso necesario para realizar la consulta', opciones.grupoRequerido, req.token.perms], 'txToken');
			let error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			let responseBody = error.send(res);
			return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.NO_AUTORIZADO };
		}
	}

	// Si se indica que se admiten simulaciones y el token es del dominio HEFAME, comprobamos si es posible realizar la simulacion
	if (opciones.admitirSimulaciones && req.token.aud === K.DOMINIOS.HEFAME) {

		// Si el nodo está en modo productivo, se debe especificar la opción 'admitirSimulacionesEnProduccion' o se rechaza al petición
		if (C.production === true && !opciones.admitirSimulacionesEnProduccion) {
			L.xw(req.txId, ['El concentrador está en PRODUCCION. No se admiten llamar al servicio de manera simulada.', req.token.perms], 'txToken');
			var error = new FedicomError('AUTH-005', 'El concentrador está en PRODUCCION. No se admiten llamadas simuladas.', 403);
			var responseBody = error.send(res);
			return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.NO_AUTORIZADO  };
		}

		// En caso de que sea viable la simulación, el usuario debe tener el permiso 'FED3_SIMULADOR'
		if (!req.token.perms || !req.token.perms.includes('FED3_SIMULADOR')) {
			L.xw(req.txId, ['El token no tiene los permisos necesarios para realizar una llamada simulada', req.token.perms], 'txToken');
			let error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar simulaciones', 403);
			let responseBody = error.send(res);
			return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.NO_AUTORIZADO  };
		} else {
			L.xi(req.txId, ['La consulta es simulada por un usuario del dominio', req.token.sub], 'txToken');
			return { ok: true, usuarioSimulador: req.token.sub };
		}
	}


	L.xi(req.txId, ['El token transmitido resultó VALIDO', req.token.sub], 'txToken');
	return { ok: true };
}


module.exports = {
	generateJWT,
	verifyJWT,
	verificaPermisos
}