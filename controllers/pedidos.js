'use strict';

const config = global.config;
const Isap = require('../interfaces/isap');
const Events = require('../interfaces/events');
const FedicomError = require('../model/FedicomError');
const Tokens = require('../util/tokens');







exports.savePedido = function (req, res) {

  Events.emitPedRequest(req);

  var token = Tokens.verifyJWT(req.token);

  if (token.meta.exception) {
    var responseBody = token.meta.exception.send(res);
    Events.emitPedResponse(res, responseBody, 'NO_AUTH');
    return;
  }

  var responseBody = {ok: true};
  res.status(201).json(responseBody);
  Events.emitPedResponse(res, responseBody, 'OK');

}
