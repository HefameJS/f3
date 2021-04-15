'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iLdap = require('interfaces/iLdap');
const iTokens = require('global/tokens');
const iCacheCredencialesSap = require('interfaces/isap/iCacheCredencialesSap');
const iFlags = require('interfaces/iFlags');
const iEventos = require('interfaces/eventos/iEventos');




// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const SolicitudAutenticacion = require('modelos/autenticacion/SolicitudAutenticacion');


// POST /authenticate
const autenticar = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación');
	iEventos.autenticacion.inicioAutenticacion(req);

	let solicitudAutenticacion = null;
	try {
		solicitudAutenticacion = new SolicitudAutenticacion(req);
	} catch (excepcion) {
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xw(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	switch (solicitudAutenticacion.dominio) {
		case C.dominios.FEDICOM:
		case C.dominios.TRANSFER:
			// Las peticiones a los dominios FEDICOM y TRANSFER se verifican contra SAP
			_autenticarContraSAP(txId, solicitudAutenticacion, res);
			return;
		case C.dominios.HEFAME:
			// Las peticiones al dominio HEFAME se verifica contra el LDAP
			_autenticarContraLDAP(txId, solicitudAutenticacion, res);
			return;
		default: {
			// Las peticiones de otros dominios no son legales
			L.xw(txId, ['No se permite la expedición de tokens para el dominio', solicitudAutenticacion.dominio]);
			let errorFedicom = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.FALLO_AUTENTICACION);
		}
	}
}

const _autenticarContraSAP = async function (txId, solicitudAutenticacion, res) {

	// Comprobacion de si la credencial del usuario se encuenta en la caché
	if (!solicitudAutenticacion.noCache) {
		let resultadoCache = iCacheCredencialesSap.chequearSolicitud(solicitudAutenticacion);
		if (resultadoCache) {
			L.xi(txId, 'Se produjo un acierto de caché en la credencial de usuario.', 'credentialCache');
			let cuerpoRespuesta = solicitudAutenticacion.generarRespuestaToken();
			res.status(201).json(cuerpoRespuesta);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.OK);
			return;
		}
	}

	L.xi(txId, ['Se procede a comprobar en SAP las credenciales de la petición']);

	try {
		let respuestaSap = await iSap.autenticacion.verificarCredenciales(solicitudAutenticacion);

		// Si el mensaje de SAP contiene el parámetro 'username', es que las credenciales son correctas.
		// de lo contrario, es que son incorrectas.
		if (respuestaSap.username) {
			let cuerpoRespuesta = solicitudAutenticacion.generarRespuestaToken();
			res.status(201).json(cuerpoRespuesta);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.OK);

			// Guardamos la entrada en caché
			if (!solicitudAutenticacion.noCache) {
				iCacheCredencialesSap.agregarEntrada(solicitudAutenticacion);
			}
		} else {
			let errorFedicom = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.FALLO_AUTENTICACION);
		}

	} catch (errorLlamadaSap) {
		
		if (errorLlamadaSap?.esSistemaSapNoDefinido()) {
			L.xe(txId, ['Error al autenticar al usuario', errorLlamadaSap]);
			let errorFedicom = new ErrorFedicom('HTTP-400', errorLlamadaSap.mensaje, 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		} else {
			L.xe(txId, ['Ocurrió un error en la llamada a SAP - Se genera token no verificado', errorLlamadaSap]);
			let cuerpoRespuesta = solicitudAutenticacion.generarRespuestaToken();
			res.status(201).json(cuerpoRespuesta);
			iFlags.set(txId, C.flags.NO_SAP);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.NO_SAP);
		}

	}

}

const _autenticarContraLDAP = async function (txId, solicitudAutenticacion, res) {
	L.xi(txId, ['Se procede a comprobar en Active Directory las credenciales de la petición']);

	try {
		let grupos = await iLdap.autenticar(txId, solicitudAutenticacion);
		L.xt(txId, ['Usuario validado por LDAP, grupos obtenidos', grupos]);
		let cuerpoRespuesta = solicitudAutenticacion.generarRespuestaToken(grupos);
		res.status(201).json(cuerpoRespuesta);
		iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.OK);
		return;
	} catch (errorLdap) {
		L.xe(txId, ['La autenticación LDAP no fue satisfatoria. No se genera token', errorLdap]);
		let error = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
		let cuerpoRespuesta = error.enviarRespuestaDeError(res);
		iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}

}


// GET /authenticate
const verificarToken = async function (req, res) {
	
	if (req.token) {
		let tokenData = iTokens.verificarToken(req.token);
		res.status(200).send({token: req.token, token_data: tokenData});
	} else {
		let tokenData = { meta: { ok: false, error: 'No se incluye token' } };
		res.status(200).send({token: req.token, token_data: tokenData});
	}
	
	res.status(200).send({ ful: 'pereful' });
}



module.exports = {
	autenticar,
	verificarToken
}