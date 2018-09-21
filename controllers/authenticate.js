'use strict';

const config = global.config;
const isap = require('../interfaces/isap');

const FedicomError = require('../model/FedicomError');





exports.doAuth = function (req, res) {

  var AuthReq = require('../model/authReq');
  var authReq = new AuthReq(req.body);

  isap.authenticate( authReq, function (sapErr, sapRes, sapBody) {
    if (sapErr) {
      console.error("HA OCURRIDO UN ERROR EN LA COMUNICACION CON SAP");
      console.error(sapErr);
      var token = authReq.generateJWT(true);
      res.status(201).json({auth_token: token, error: sapErr});
      return;
    }

    if (sapBody.username) {
      // AUTH OK POR SAP
      var token = authReq.generateJWT();
      res.status(201).json({auth_token: token});
    } else {
      // SAP INDICA QUE EL USUARIO NO ES VALIDO
      var fedicomError = new FedicomError('AUTH-003', 'Usuario o contraseña inválidos', 401);
      fedicomError.send(res);
    }

  });
}

/**
Servicio para la verificación de tokens.
Para depuración exclusivamente.
*/
exports.verifyToken = function (req, res) {

  if (req.token) {
    const crypto = require('../util/crypto');
    var tokenData = crypto.verifyJWT(req.token);
    res.status(200).send({token: req.token, token_data: tokenData});
  } else {
    var tokenData = { meta: { ok: false, error: 'No se incluye token' } };
    res.status(200).send({token: req.token, token_data: tokenData});
  }


}
