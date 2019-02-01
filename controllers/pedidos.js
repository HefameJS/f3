'use strict';

const config = global.config;
const Isap = require('../interfaces/isap');
const Imongo = require('../interfaces/imongo');
const Events = require('../interfaces/events');
const FedicomError = require('../model/fedicomError');
const Tokens = require('../util/tokens');
const Pedido = require('../model/pedido');
const sanitizeSapResponse = require('../util/responseSanitizer');
const txStatus = require('../model/txStatus');





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


				var response = sanitizeSapResponse(sapBody, pedido);


				console.log("COMUNICACION CON SAP CORRECTA");
				res.status(201).json(response);
				Events.emitPedRes(res, response, txStatus.ESPERANDO_NUMERO_PEDIDO);
			});
		}
	});

}


exports.getPedido = function (req, res) {

	var numeroPedido = req.params.numeroPedido || req.query.numeroPedido;


	req.token = Tokens.verifyJWT(req.token);
	if (req.token.meta.exception) {
		// Fallo en el login
		var responseBody = req.token.meta.exception.send(res);
		Events.emitPedQueryError(req, res, responseBody, txStatus.FALLO_AUTENTICACION);
		return;
	}



	Imongo.findTxByCrc( numeroPedido, function (err, dbTx) {
		if (err) {
			var error = new FedicomError('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
			var responseBody = error.send(res);
			Events.emitPedQueryError(req, res, responseBody, txStatus.PETICION_INCORRECTA);
			return;
		}

		Events.emitPedQueryReq(req);
		console.log('El pedido recuperado de la bbdd es: ');
		console.log(dbTx);

		if (dbTx && dbTx.clientResponse)	{
			// TODO: Autorizacion
			var originalBody = dbTx.clientResponse.body;
			res.status(200).json(originalBody);
			Events.emitPedQueryRes(res, originalBody, txStatus.OK);
		} else {
			var error = new FedicomError('PED-ERR-001', 'El pedido solicitado no existe', 404);
			var responseBody = error.send(res);
			Events.emitPedQueryError(req, res, responseBody, txStatus.NO_EXISTE_PEDIDO);
		}
	});

}
