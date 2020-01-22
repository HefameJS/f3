'use strict';
const BASE = global.BASE;
const L = global.logger;
//const C = global.config;
const K = global.constants;

const Isap = require(BASE + 'interfaces/isap');
const Ildap = require(BASE + 'interfaces/ildap');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const AuthReq = require(BASE + 'model/auth/authReq');
const Tokens = require(BASE + 'util/tokens');
const Flags = require(BASE + 'interfaces/cache/flags');




exports.doAuth = function (req, res) {
	var txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación')
	Events.authentication.emitAuthRequest(req);


	try {
		var authReq = new AuthReq(txId, req.body);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(txId, fedicomError);
		L.xe(txId, ['Ocurrió un error al analizar la petición', fedicomError])
		var responseBody = fedicomError.send(res);
		Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}
	
	// Las peticiones a los dominios FEDICOM y TRANSFER se verifican contra SAP
	if (authReq.domain === K.DOMINIOS.FEDICOM || authReq.domain === K.DOMINIOS.TRANSFER) {
		L.xi(txId, ['Se procede a comprobar en SAP las credenciales de la petición']);
		Isap.authenticate(txId, authReq, function (sapError, sapResponse) {
			if (sapError) {
				if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
					var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
					L.xe(txId, ['Error al autenticar al usuario', sapError]);
					var responseBody = fedicomError.send(res);
					Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
				}
				else {
					L.xe(txId, ['Ocurrió un error en la llamada a SAP - Se genera token no verificado', sapError]);
					var token = authReq.generateJWT(txId);
					var responseBody = {auth_token: token};
					res.status(201).json(responseBody);

					Flags.set(txId, K.FLAGS.NO_SAP)
					Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.NO_SAP);
				}
				return;
			}

			// Ojo que sapRes podría ser NULL si hubo acierto en caché

			if (sapResponse.body.username) {
				// AUTH OK POR SAP

				var token = authReq.generateJWT(txId);
				var responseBody = {auth_token: token};
				if (authReq.debug) responseBody.data = Tokens.verifyJWT(token);
				res.status(201).json(responseBody);
				Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.OK);
			} else {
				// SAP INDICA QUE EL USUARIO NO ES VALIDO
				var fedicomError = new FedicomError('AUTH-005', 'Usuario o contraseña inválidos', 401);
				var responseBody = fedicomError.send(res);
				Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
			}
		});
	}
	// Las peticiones al dominio HEFAME se verifica contra el LDAP
	else if (authReq.domain === K.DOMINIOS.HEFAME) {
		L.xi(txId, ['Se procede a comprobar en Active Directory las credenciales de la petición']);
		Ildap.authenticate(txId, authReq, function (ldapError, groups) {
			if (ldapError || !groups) {
				L.xe(txId, ['Las credenciales indicadas no son correctas - No se genera token', ldapError]);
				var fedicomError = new FedicomError('AUTH-005', 'Usuario o contraseña inválidos', 401);
				var responseBody = fedicomError.send(res);
				Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
				return;
			}

			// AUTH OK POR LDAP
			var token = authReq.generateJWT(txId, groups);
			var responseBody = { auth_token: token };
			if (authReq.debug) responseBody.data = Tokens.verifyJWT(token);
			res.status(201).json(responseBody);
			Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.OK);

		});
	}
	// Si es una autenticación con token de APIKEY, por el momento la dejamos pasar.
	else if (authReq.domain === K.DOMINIOS.APIKEY) {
		L.xi(txId, ['Los tokens del dominio APIKEY se dejan pasar por el momento']);
		var token = authReq.generateJWT(txId);
		var responseBody = {auth_token: token};
		if (authReq.debug) responseBody.data = Tokens.verifyJWT(token);
		res.status(201).json(responseBody);
		Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.OK);
	}
	// Cualquier otro dominio no es válido para crear tokens !
	else {
		L.xi(txId, ['No se permite la expedición de tokens para el dominio', authReq.domain]);
		var fedicomError = new FedicomError('AUTH-005', 'Usuario o contraseña inválidos', 401);
		var responseBody = fedicomError.send(res);
		Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
	}

}

/**
Servicio para la verificación de tokens.
Para depuración exclusivamente.
*/
exports.verifyToken = function (req, res) {
	if (req.token) {
		var tokenData = Tokens.verifyJWT(req.token);
		res.status(200).send({token: req.token, token_data: tokenData});
	} else {
		var tokenData = { meta: { ok: false, error: 'No se incluye token' } };
		res.status(200).send({token: req.token, token_data: tokenData});
	}
}
