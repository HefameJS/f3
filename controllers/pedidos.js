'use strict';

const config = global.config;
const Isap = require('../interfaces/isap');
const Imongo = require('../interfaces/imongo');
const Events = require('../interfaces/events');
const FedicomError = require('../model/fedicomError');
const Tokens = require('../util/tokens');
const Pedido = require('../model/pedido');
const sanitizeSapResponse = require('../util/responseSanitizer');





exports.savePedido = function (req, res) {

	req.token = Tokens.verifyJWT(req.token);
	if (req.token.meta.exception) {
		// Fallo en el login
		var responseBody = req.token.meta.exception.send(res);
		Events.emitPedError(req, res, responseBody, txStatus.FALLO_AUTENTICACION);
		return;
	}

	try {
  		var pedido = new Pedido(req);
	} catch (ex) {
		// Hay fallo al parsear el mensaje del pedido,
		var responseBody = ex.send(res);
		Events.emitPedError(req, res, responseBody, txStatus.PETICION_INCORRECTA);
		return;
	}



	Imongo.findTxByCrc( pedido, function (err, dbTx) {
		if (err) {
			console.log('Error al consultar si el pedido ya estaba en la BBDD');
		}

		console.log('El pedido recuperado de la bbdd es: ');
		console.log(dbTx);

		if (dbTx && dbTx.clientResponse)	{
			console.log("LO QUE SE MANDO AL CLIENTE ES");
			console.log("----------------------------");
			console.log(dbTx.clientResponse);
			console.log("----------------------------");

			var dupeResponse = dbTx.clientResponse.body;
			if (!dupeResponse.errno) {
				if (!dupeResponse.incidencias) {
					dupeResponse.incidencias = [ {codigo: 'PED-WARN-Z99', descripcion: 'Pedido duplicado'} ];
				} else {
					dupeResponse.incidencias.push({codigo: 'PED-WARN-Z99', descripcion: 'Pedido duplicado'});
				}
			}

			res.status(dbTx.clientResponse.statusCode).json(dupeResponse);
			Events.emitPedDuplicated(req, res, dupeResponse, dbTx);

		} else {

			Events.emitPedReq(req, pedido);

			Isap.realizarPedido( req.txId, pedido, function(sapErr, sapRes, sapBody) {
				if (sapErr) {
					console.log("INDICENCIA EN LA COMUNICACION SAP");
					console.log(sapErr);
					res.status(500).json(sapErr);
					Events.emitPedRes(res, sapErr, txStatus.NO_SAP);
					return;
				}

				sapBody = sanitizeSapResponse(sapBody);

				console.log("COMUNICACION CON SAP CORRECTA");
				res.status(201).json(sapBody);
				Events.emitPedRes(res, sapBody, txStatus.ESPERANDO_NUMERO_PEDIDO);
			});
		}


});

}
