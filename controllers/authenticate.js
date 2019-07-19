'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;

const Isap = require(BASE + 'interfaces/isap');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const controllerHelper = require(BASE + 'util/controllerHelper');
const txStatus = require(BASE + 'model/txStatus');




exports.doAuth = function (req, res) {
	var txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación')
	Events.authentication.emitAuthRequest(req);


  var AuthReq = require(BASE + 'model/authReq');
  try {
	  var authReq = new AuthReq(req.body, txId);
  } catch (ex) {
	  var responseBody = controllerHelper.sendException(ex, req, res);
	  Events.authentication.emitAuthResponse(res, responseBody, txStatus.PETICION_INCORRECTA);
	  return;
  }

	if (authReq.domain === 'FEDICOM') {
		Isap.authenticate(req.txId, authReq, function (sapErr, sapRes, sapBody) {
			if (sapErr) {
				L.xe(txId, ['Ocurrió un error en la llamada a SAP. Se genera token temporal.', sapErr]);
				var token = authReq.generateJWT(true);
				var responseBody = {auth_token: token};
				res.status(201).json(responseBody);
				Events.authentication.emitAuthResponse(res, responseBody, txStatus.NO_SAP);
				return;
			}

			if (sapBody.username) {
				// AUTH OK POR SAP
				var token = authReq.generateJWT();
				var responseBody = {auth_token: token};
				res.status(201).json(responseBody);
				Events.authentication.emitAuthResponse(res, responseBody, txStatus.OK);
			} else {
				// SAP INDICA QUE EL USUARIO NO ES VALIDO
				var fedicomError = new FedicomError('AUTH-005', 'Usuario o contraseña inválidos', 401);
				var responseBody = fedicomError.send(res);
				Events.authentication.emitAuthResponse(res, responseBody, txStatus.FALLO_AUTENTICACION);
			}
		});
	} else { // ES UN TOKEN DE UN DOMINIO NO FEDICOM - POR AHORA LO DEJAMOS PASAR
		var token = authReq.generateJWT();
		var responseBody = {auth_token: token};
		res.status(201).json(responseBody);
		Events.authentication.emitAuthResponse(res, responseBody, txStatus.OK);
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
