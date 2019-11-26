'use strict';
const BASE = global.BASE;
const L = global.logger;
//const C = global.config;
const K = global.constants;

const Isap = require(BASE + 'interfaces/isap');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const AuthReq = require(BASE + 'model/auth/authReq');
const Domain = require(BASE + 'model/auth/domain');




exports.doAuth = function (req, res) {
	var txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación')
	Events.authentication.emitAuthRequest(req);

	try {
		var authReq = new AuthReq(req.body);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(txId, fedicomError);
		L.xe(txId, ['Ocurrió un error al analizar la petición', fedicomError])
		var responseBody = fedicomError.send(res);
		Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	if (authReq.domain === Domain.domains.fedicom || authReq.domain === Domain.domains.transfer) {

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
					Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.NO_SAP);
				}
				return;
			}

			// Ojo que sapRes podría ser NULL si hubo acierto en caché

			if (sapResponse.body.username) {
				// AUTH OK POR SAP
				var token = authReq.generateJWT(txId);
				var responseBody = {auth_token: token};
				res.status(201).json(responseBody);
				Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.OK);
			} else {
				// SAP INDICA QUE EL USUARIO NO ES VALIDO
				var fedicomError = new FedicomError('AUTH-005', 'Usuario o contraseña inválidos', 401);
				var responseBody = fedicomError.send(res);
				Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
			}
		});

	} else { // ES UN TOKEN DE UN DOMINIO NO FEDICOM - POR AHORA LO DEJAMOS PASAR
		var token = authReq.generateJWT(txId);
		var responseBody = {auth_token: token};
		res.status(201).json(responseBody);
		Events.authentication.emitAuthResponse(res, responseBody, K.TX_STATUS.OK);
	}
}

/**
Servicio para la verificación de tokens.
Para depuración exclusivamente.
*/
exports.verifyToken = function (req, res) {
	if (req.token) {
		const Tokens = require(BASE + 'util/tokens');
		var tokenData = Tokens.verifyJWT(req.token);
		res.status(200).send({token: req.token, token_data: tokenData});
	} else {
		var tokenData = { meta: { ok: false, error: 'No se incluye token' } };
		res.status(200).send({token: req.token, token_data: tokenData});
	}
}
