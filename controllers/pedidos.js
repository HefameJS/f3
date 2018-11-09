'use strict';

const config = global.config;
const Isap = require('../interfaces/isap');
const Imongo = require('../interfaces/imongo');
const Events = require('../interfaces/events');
const FedicomError = require('../model/FedicomError');
const Tokens = require('../util/tokens');
const Pedido = require('../model/pedido');
const sanitizeSapResponse = require('../util/responseSanitizer');





exports.savePedido = function (req, res) {

	var token = Tokens.verifyJWT(req.token);
	// Fallo en el login
	if (token.meta.exception) {
		console.log(token);
		var responseBody = token.meta.exception.send(res);
		Events.emitPedError(req, res, responseBody, 'NO_AUTH');
		return;
	}

	try {
  		var pedido = new Pedido(req.body);
		pedido.setLoginData(token);
	} catch (ex) {
		// Hay fallo al parsear el mensaje del pedido,
		console.log(ex);
		var responseBody = ex.send(res);
		Events.emitPedError(req, res, responseBody, 'BAD_REQUEST');
		return;
	}



	Imongo.findTxByCrc( pedido, function (err, dbTx) {
		if (err) {
			console.log('Error al consultar si el pedido ya estaba en la BBDD');
		}

		console.log('El pedido recuperado de la bbdd es: ');
		console.log(dbTx);

		if (dbTx && dbTx.clientResponse)	{
			var dupeResponse = dbTx.clientResponse.body;
			if (!dupeResponse.incidencias) {
				dupeResponse.incidencias = [ {codigo: 'PED-WARN-Z99', descripcion: 'Pedido duplicado'} ];
			} else {
				dupeResponse.incidencias.push({codigo: 'PED-WARN-Z99', descripcion: 'Pedido duplicado'});
			}

			res.status(201).json(dupeResponse);
			Events.emitPedDuplicated(req, res, dupeResponse, dbTx);

		} else {

			Events.emitPedReq(req, pedido);

			Isap.realizarPedido( req.txId, pedido, function(sapErr, sapRes, sapBody) {
				if (sapErr) {
					console.log("INDICENCIA EN LA COMUNICACION SAP");
					console.log(sapErr);

					res.status(500).json(sapErr);
					Events.emitPedRes(res, sapBody, 'OK_NO_SAP');
					return;
				}

				sapBody = sanitizeSapResponse(sapBody);

				console.log("COMUNICACION CON SAP CORRECTA");
				res.status(201).json(sapBody);
				Events.emitPedRes(res, sapBody, 'OK');
			});
		}


});

}
