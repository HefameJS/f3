'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externas
const jwt = require('jsonwebtoken');

// Interfaces
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');




const generarToken = (txId, autenticacion, permisos) => {

	let datosToken = {
		sub: autenticacion.usuario,
		aud: autenticacion.dominio,
		exp: Math.ceil((Date.fedicomTimestamp() / 1000) + C.jwt.ttl),
		jti: txId
	};

	if (permisos && permisos.forEach) datosToken.perms = permisos;

	let token = jwt.sign(datosToken, C.jwt.clave);
	L.xi(txId, ['Generado JWT', token, datosToken], 'jwt');
	return token;
}

const generarTokenInterFedicom = () => {
	let datosToken = {
		sub: process.iid,
		aud: C.dominios.INTERFEDICOM,
		exp: 9999999999999
	};

	let token = jwt.sign(datosToken, C.jwt.clave);
	L.i(['Generado JWT Interfedicom', token, datosToken], 'jwt');
	return token;
}

const verificarToken = (token, txId) => {

	if (!token) {
		if (txId) L.xt(txId, ['Se rechaza porque no hay token'], 'txToken');
		else L.t(['Se rechaza porque no hay token'], 'txToken');
		return {
			meta: {
				ok: false,
				error: 'No se especifica token',
				errorFedicom: new ErrorFedicom('AUTH-002', 'Token inválido', 401)
			}
		}
	}

	try {
		let decoded = jwt.verify(token, C.jwt.clave);

		// Comprobacion para levantar el flag de transfer
		if (decoded.sub && decoded.sub.search(/^T[RGP]/) === 0) {
			if (txId) iFlags.set(txId, C.flags.TRANSFER);
		}

		let meta = {};

		if (decoded.exp) {
			let diff = (Date.fedicomTimestamp() / 1000) - decoded.exp;
			if (diff > ((C.jwt.tiempoDeGracia || 10))) {
				if (txId) L.xt(txId, ['Se rechaza porque el token está caducado por ' + diff + 'ms'], 'txToken');
				// TOKEN CADUCADO
				meta = {
					ok: false,
					error: 'Token caducado',
					errorFedicom: new ErrorFedicom('AUTH-001', 'Usuario no autentificado', 401)
				}
			} else {
				// TOKEN OK
				meta = {
					ok: true
				}
			}
		} else {
			// ¿No contiene campo 'exp'? ESTO ES UN FAKE
			if (txId) L.xt(txId, ['El token no contiene el campo EXP !!'], 'txToken');
			else L.t(['El token no contiene el campo EXP !!'], 'txToken');

			meta = {
				ok: false,
				error: 'Token incompleto',
				errorFedicom: new ErrorFedicom('AUTH-002', 'Token inválido', 401)
			}
		}
		decoded.meta = meta;
		return decoded;

	} catch (err) {

		if (txId) L.xt(txId, ['Se rechaza porque el token es invalido', err], 'txToken');
		L.t(['Se rechaza porque el token es invalido', err], 'txToken');
		return {
			meta: {
				ok: false,
				error: err.message,
				errorFedicom: new ErrorFedicom('AUTH-002', 'Token inválido', 401)
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

	L.xt(txId, ['Realizando control de autorización', req.token, opciones], 'txToken')

	// Primerísimo de todo, el token debe ser válido
	if (req.token.meta.errorFedicom) {
		L.xw(txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		let cuerpoRespuesta = req.token.meta.errorFedicom.enviarRespuestaDeError(res);
		return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.FALLO_AUTENTICACION };
	}

	// El dominio 'INTERFEDICOM' solo se permite en llamadas al proceso de monitor, nunca al core
	if (req.token.aud === C.dominios.INTERFEDICOM) {
		if (process.tipo === K.PROCESOS.TIPOS.MONITOR) {
			// TODO: Falta hacer control de admision por IP origen
			L.xi(txId, ['Se acepta el token INTERFEDICOM'], 'txToken')
			return { ok: true };
		}

		L.xw(txId, ['El token es del dominio INTERFEDICOM y no se admite para este tipo de consulta'], 'txToken');
		let errorFedicom = new ErrorFedicom('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
	}

	// Si se indica la opcion grupoRequerido, es absolutamente necesario que el token lo incluya
	if (opciones.grupoRequerido) {
		if (!req.token.perms || !req.token.perms.includes(opciones.grupoRequerido)) {
			L.xw(txId, ['El token no tiene el permiso necesario', opciones.grupoRequerido, req.token.perms], 'txToken');
			let errorFedicom = new ErrorFedicom('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
		}
	}

	// Si se indica que se admiten simulaciones y el token es del dominio HEFAME, comprobamos si es posible realizar la simulacion
	if (opciones.admitirSimulaciones && req.token.aud === C.dominios.HEFAME) {

		// Si el nodo está en modo productivo, se debe especificar la opción 'admitirSimulacionesEnProduccion' o se rechaza al petición
		if (C.produccion === true && !opciones.admitirSimulacionesEnProduccion) {
			L.xw(txId, ['El concentrador está en PRODUCCION. No se admiten llamar al servicio de manera simulada.', req.token.perms], 'txToken');
			let errorFedicom = new ErrorFedicom('AUTH-005', 'El concentrador está en PRODUCCION. No se admiten llamadas simuladas.', 403);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
		}

		// En caso de que sea viable la simulación, el usuario debe tener el permiso 'FED3_SIMULADOR'
		if (!req.token.perms || !req.token.perms.includes('FED3_SIMULADOR')) {
			L.xw(txId, ['El token no tiene los permisos necesarios para realizar una llamada simulada', req.token.perms], 'txToken');
			let errorFedicom = new ErrorFedicom('AUTH-005', 'No tienes los permisos necesarios para realizar simulaciones', 403);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
		} else {
			L.xi(txId, ['La consulta es simulada por un usuario del dominio', req.token.sub], 'txToken');

			// Generamos un token con el usuario/dominio indicado en el campo 'authReq' del body
			let solicitudAutenticacion = null;
			if (req.body?.authReq && req.body.authReq.username && req.body.authReq.domain) {
				solicitudAutenticacion = {
					usuario: req.body.authReq.username,
					dominio: req.body.authReq.domain
				}
				L.xi(txId, ['La solicitid simulada viene con una solicitud de autenticación', solicitudAutenticacion], 'txToken')
				let newToken = generarToken(txId, solicitudAutenticacion, []);
				L.xd(txId, ['Se ha generado un token para la solicitud de autenticacion simulada', newToken], 'txToken');
				req.headers['authorization'] = 'Bearer ' + newToken;
				req.token = verificarToken(newToken, txId);
			}

			if (opciones.simulacionRequiereSolicitudAutenticacion && !solicitudAutenticacion) {
				L.xe(txId, ['No se incluye solicitud de autenticación y esta es obligatoria'], 'txToken');
				let errorFedicom = new ErrorFedicom('AUTH-999', 'No se indica el usuario objetivo de la transmisión', 400);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.PETICION_INCORRECTA };
			}

			return { ok: true, usuarioSimulador: req.token.sub, solicitudAutenticacion: solicitudAutenticacion };
		}
	}


	L.xi(txId, ['El token transmitido es correcto y está autorizado', req.token], 'txToken');
	return { ok: true };
}


module.exports = {
	generarToken,
	generarTokenInterFedicom,
	verificarToken,
	verificaPermisos
}