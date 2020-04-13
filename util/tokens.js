'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iFlags = require(BASE + 'interfaces/iFlags');

// Modelos
const FedicomError = require(BASE + 'model/fedicomError');

const jwt = require('jsonwebtoken');

const generarToken = (txId, authReq, perms) => {
	
	let jwtData = {
		sub: authReq.username,
		aud: authReq.domain,
		exp: Math.ceil(Date.fedicomTimestamp() / 1000) + (60 * (C.jwt.token_lifetime_minutes || 30)),
		jti: txId
	};

	if (perms && perms.forEach) jwtData.perms = perms

	let token = jwt.sign(jwtData, C.jwt.token_signing_key);
	L.xi(txId, ['Generado JWT', token, jwtData], 'jwt');
	return token;
}


const verificarToken = (token, txId) => {

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

	try {
		let decoded = jwt.verify(token, C.jwt.token_signing_key);

		// Comprobacion para levantar el flag de transfer
		if (decoded.sub && decoded.sub.search(/^T[RGP]/) === 0) {
			iFlags.set(txId, K.FLAGS.TRANSFER);
		}

		let meta = {};

		if (decoded.exp) {
			let diff = (Date.fedicomTimestamp() / 1000) - decoded.exp;
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
 * En el caso de simulaciones, la respuesta incluirá la propiedad 'usuarioSimulador' indicando el usuario del dominio que ordena la simulación y opcionalmente
 * se la propiedad 'solicitudAutenticacion' con la solicitud de autenticación simulada.
 * 
 * Opciones:
 *  - grupoRequerido: Indica el nombre de un grupo que debe estar presente en el token, o de lo contrario el token será rechazado.
 * 	- admitirSimulaciones: Indica si se admiten consultas simuladas. Esto indica que en principio, los tokens del dominio HEFAME con el permiso 'FED3_SIMULADOR' se considerarán válidos.
 *  - admitirSimulacionesEnProduccion: (requiere admitirSimulaciones = true) Por defecto, las simulaciones en sistemas productivos son rechazadas. Activar esta opción para permitirlas igualmente.
 * 		Generalmente se usa para servicios de consulta donde no hay peligro en lanzarlos contra producción.
 *  - simulacionRequiereSolicitudAutenticacion: (requiere admitirSimulaciones = true) Indica si la simulación debe ir acompañada de una solicitud de autenticación. Esto hará que se busque el campo
 * 		req.body.authReq = {username: "xxxx", domain: "yyyy"} y se genere un token simulando como si la petición viniera con estas credenciales. Si no existiera, se rechaza la petición.
 */
const DEFAULT_OPTS = {
	grupoRequerido: null,
	admitirSimulaciones: false,
	admitirSimulacionesEnProduccion: false,
	simulacionRequiereSolicitudAutenticacion: false
}
const verificaPermisos = (req, res, opciones) => {

	let txId = req.txId;

	opciones = { ...DEFAULT_OPTS, ...opciones }

	L.xt(txId, ['Verificando validez de token', req.token, opciones], 'txToken')

	req.token = verificarToken(req.token, txId);
	if (req.token.meta.exception) {
		L.xe(txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		let responseBody = req.token.meta.exception.send(res);
		return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.FALLO_AUTENTICACION  };
	}

	// Si se indica la opcion grupoRequerido, es absolutamente necesario que el token lo incluya
	if (opciones.grupoRequerido) {
		if (!req.token.perms || !req.token.perms.includes(opciones.grupoRequerido)) {
			L.xw(txId, ['El token no tiene el permiso necesario para realizar la consulta', opciones.grupoRequerido, req.token.perms], 'txToken');
			let error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			let responseBody = error.send(res);
			return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.NO_AUTORIZADO };
		}
	}

	// Si se indica que se admiten simulaciones y el token es del dominio HEFAME, comprobamos si es posible realizar la simulacion
	if (opciones.admitirSimulaciones && req.token.aud === K.DOMINIOS.HEFAME) {

		// Si el nodo está en modo productivo, se debe especificar la opción 'admitirSimulacionesEnProduccion' o se rechaza al petición
		if (C.production === true && !opciones.admitirSimulacionesEnProduccion) {
			L.xw(txId, ['El concentrador está en PRODUCCION. No se admiten llamar al servicio de manera simulada.', req.token.perms], 'txToken');
			var error = new FedicomError('AUTH-005', 'El concentrador está en PRODUCCION. No se admiten llamadas simuladas.', 403);
			var responseBody = error.send(res);
			return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.NO_AUTORIZADO  };
		}

		// En caso de que sea viable la simulación, el usuario debe tener el permiso 'FED3_SIMULADOR'
		if (!req.token.perms || !req.token.perms.includes('FED3_SIMULADOR')) {
			L.xw(txId, ['El token no tiene los permisos necesarios para realizar una llamada simulada', req.token.perms], 'txToken');
			let error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar simulaciones', 403);
			let responseBody = error.send(res);
			return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.NO_AUTORIZADO  };
		} else {
			L.xi(txId, ['La consulta es simulada por un usuario del dominio', req.token.sub], 'txToken');

			let solicitudAutenticacion = null;

			if (req.body && req.body.authReq && req.body.authReq.username && req.body.authReq.domain) {
				solicitudAutenticacion = req.body.authReq;
				L.xi(txId, ['La solicitid simulada viene con una solicitud de autenticación', solicitudAutenticacion], 'txToken')
				let newToken = generarToken(req.txId, solicitudAutenticacion, []);
				L.xd(txId, ['Se ha generado un token para la solicitud de autenticacion simulada', newToken], 'txToken');
				req.headers['authorization'] = 'Bearer ' + newToken;
				req.token = verificarToken(newToken, req.txId);
			}

			if (opciones.simulacionRequiereSolicitudAutenticacion && !solicitudAutenticacion) {
				L.xe(txId, ['No se incluye solicitud de autenticación y esta es obligatoria'], 'txToken');
				let error = new FedicomError('AUTH-999', 'No se indica el usuario objetivo de la transmisión', 400);
				let responseBody = error.send(res);
				return { ok: false, respuesta: responseBody, motivo: K.TX_STATUS.PETICION_INCORRECTA };
			} 

			return { ok: true, usuarioSimulador: req.token.sub, solicitudAutenticacion: solicitudAutenticacion };
		}
	}


	L.xi(req.txId, ['El token transmitido resultó VALIDO', req.token.sub], 'txToken');
	return { ok: true };
}


module.exports = {
	generarToken,
	verificarToken,
	verificaPermisos
}