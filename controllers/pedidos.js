'use strict';

const config = global.config;
const Isap = require('../interfaces/isap');
const Events = require('../interfaces/events');
const FedicomError = require('../model/FedicomError');
const Tokens = require('../util/tokens');
const Pedido = require('../model/pedido');







exports.savePedido = function (req, res) {

	Events.emitPedRequest(req);
	var token = Tokens.verifyJWT(req.token);

	if (token.meta.exception) {
		console.log(token);
		var responseBody = token.meta.exception.send(res);
		Events.emitPedResponse(res, responseBody, 'NO_AUTH');
		return;
	}

	try {
  		var pedido = new Pedido(req.body);
		pedido.setLoginData(token);
	} catch (ex) {
		console.log(ex);
		var responseBody = ex.send(res);
		Events.emitPedResponse(res, responseBody, 'BAD_REQUEST');
		return;
	}

	Isap.realizarPedido( req.txId, pedido, function (sapErr, sapRes, sapBody) {
		// res.status(201).json(pedido);
		// Events.emitPedResponse(res, pedido, 'OK');
		if (sapErr) {
			// pedido.incidencias.addIncidencia()
			console.log("INDICENCIA EN LA COMUNICACION SAP");
			console.log(sapErr);

			res.status(500).json(sapErr);
			Events.emitPedResponse(res, sapBody, 'OK_NO_SAP');
			return;
      }

		res.status(201).json(sapBody);
		Events.emitPedResponse(res, sapBody, 'OK');
	});

}
