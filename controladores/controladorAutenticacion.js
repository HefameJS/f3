'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iLdap = require('interfaces/iLdap');
const iTokens = require('global/tokens');
const iFlags = require('interfaces/iFlags');
//const iEventos = require('interfaces/eventos/iEventos');




// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const SolicitudAutenticacion = require('modelos/autenticacion/SolicitudAutenticacion');


// POST /authenticate
const autenticar = function (req, res) {

	let txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación');
	//iEventos.autenticacion.inicioAutenticacion(req);

	let solicitudAutenticacion = null;
	try {
		solicitudAutenticacion = new SolicitudAutenticacion(req);
	} catch (excepcion) {
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		//iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Las peticiones a los dominios FEDICOM y TRANSFER se verifican contra SAP

	switch (solicitudAutenticacion.dominio) {
		case C.dominios.FEDICOM:
		case C.dominios.TRANSFER:
			res.status(200).json(solicitudAutenticacion.generarJSON());
			//_autenticarContraSAP(txId, solicitudAutenticacion, res);
			return;
		case C.dominios.HEFAME:
			_autenticarContraLDAP(txId, solicitudAutenticacion, res);
			return;
		default: {
			L.xi(txId, ['No se permite la expedición de tokens para el dominio', solicitudAutenticacion.dominio]);
			let errorFedicom = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.FALLO_AUTENTICACION);
		}
	}

	// res.status(200).json(solicitudAutenticacion.generarJSON());

}

const _autenticarContraSAP = (txId, solicitudAutenticacion, res) => {
	L.xi(txId, ['Se procede a comprobar en SAP las credenciales de la petición']);
	iSap.autenticacion.verificarCredenciales(txId, solicitudAutenticacion, (errorSap, respuestaSap) => {
		if (errorSap) {
			if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
				let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
				L.xe(txId, ['Error al autenticar al usuario', errorSap]);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
			}
			else {
				L.xe(txId, ['Ocurrió un error en la llamada a SAP - Se genera token no verificado', errorSap]);
				let token = solicitudAutenticacion.generarToken();
				let cuerpoRespuesta = { auth_token: token };
				res.status(201).json(cuerpoRespuesta);

				iFlags.set(txId, C.flags.NO_SAP)
				iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.NO_SAP);
			}
			return;
		}

		if (respuestaSap.body.username) {
			// AUTH OK POR SAP

			let token = solicitudAutenticacion.generarToken();
			let cuerpoRespuesta = { auth_token: token };

			// Si se indica el campo debug = true, se incluyen el resultado de verificar el token en el campo data.
			if (solicitudAutenticacion.debug)
				cuerpoRespuesta.data = iTokens.verificarToken(token);

			res.status(201).json(cuerpoRespuesta);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.OK);
		} else {
			// SAP INDICA QUE EL USUARIO NO ES VALIDO
			let errorFedicom = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.FALLO_AUTENTICACION);
		}
	});
}

const _autenticarContraLDAP = async function (txId, solicitudAutenticacion, res) {
	L.xi(txId, ['Se procede a comprobar en Active Directory las credenciales de la petición']);

	try {
		let grupos = await iLdap.autenticar(txId, solicitudAutenticacion);

		L.xt(txId, ['Usuario validado por LDAP, grupos obtenidos', grupos]);
		// AUTH OK POR LDAP
		let token = solicitudAutenticacion.generarToken(grupos);
		let cuerpoRespuesta = { auth_token: token };
		if (solicitudAutenticacion.debug) cuerpoRespuesta.data = iTokens.verificarToken(token);
		res.status(201).json(cuerpoRespuesta);
		//iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.OK);

	} catch (errorLdap) {
		L.xe(txId, ['Las credenciales indicadas no son correctas - No se genera token', errorLdap]);
		let error = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
		let cuerpoRespuesta = error.enviarRespuestaDeError(res);
		//iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}

}


// GET /authenticate
const verificarToken = (req, res) => {
	/*
	if (req.token) {
		let tokenData = iTokens.verificarToken(req.token);
		res.status(200).send({token: req.token, token_data: tokenData});
	} else {
		let tokenData = { meta: { ok: false, error: 'No se incluye token' } };
		res.status(200).send({token: req.token, token_data: tokenData});
	}
	*/
	res.status(200).send({ ful: 'pereful' });
}



module.exports = {
	autenticar,
	verificarToken
}