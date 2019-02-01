'use strict';

const config = global.config;
const Isap = require('../interfaces/isap');
const Events = require('../interfaces/events');
const FedicomError = require('../model/fedicomError');
const txStatus = require('../model/txStatus');

const L = global.logger;



exports.doAuth = function (req, res) {
	var txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación')
	Events.emitAuthRequest(req);


  var AuthReq = require('../model/authReq');
  try {
	  var authReq = new AuthReq(req.body, txId);
  } catch (ex) {
	  L.xe(txId, ['Ocurrió un error al analizar la petición de autenticación', ex], 'exception')
	  var responseBody = ex.send(res);
	  Events.emitAuthResponse(res, responseBody, txStatus.PETICION_INCORRECTA);
	  return;
  }

  Isap.authenticate(req.txId, authReq, function (sapErr, sapRes, sapBody) {
    if (sapErr) {
		L.xe(txId, ['Ocurrió un error en la llamada a SAP. Se genera token temporal.', sapErr]);
      var token = authReq.generateJWT(true);
      var responseBody = {auth_token: token};
      res.status(201).json(responseBody);
      Events.emitAuthResponse(res, responseBody, txStatus.NO_SAP);
      return;
    }

    if (sapBody.username) {
      // AUTH OK POR SAP
      var token = authReq.generateJWT();
      var responseBody = {auth_token: token};
      res.status(201).json(responseBody);
      Events.emitAuthResponse(res, responseBody, txStatus.OK);
    } else {
      // SAP INDICA QUE EL USUARIO NO ES VALIDO
      var fedicomError = new FedicomError('AUTH-005', 'Usuario o contraseña inválidos', 401);
      var responseBody = fedicomError.send(res);
      Events.emitAuthResponse(res, responseBody, txStatus.FALLO_AUTENTICACION);
    }

  });
}

/**
Servicio para la verificación de tokens.
Para depuración exclusivamente.
*/
exports.verifyToken = function (req, res) {

  if (req.token) {
    const Tokens = require('../util/tokens');
    var tokenData = Tokens.verifyJWT(req.token);
    res.status(200).send({token: req.token, token_data: tokenData});
  } else {
    var tokenData = { meta: { ok: false, error: 'No se incluye token' } };
    res.status(200).send({token: req.token, token_data: tokenData});
  }


}
