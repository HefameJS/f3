'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;

const Imongo = require(BASE + 'interfaces/imongo');
const Isap = require(BASE + 'interfaces/isap');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const controllerHelper = require(BASE + 'util/controllerHelper');
const txStatus = require(BASE + 'model/static/txStatus');
const txTypes = require(BASE + 'model/static/txTypes');
const Pedido = require(BASE + 'model/pedido/pedido');
const sanitizeSapResponse = require(BASE + 'util/responseSanitizer');




exports.retransmit = function (req, res) {



	var txId = req.params.txId || req.query.txId;
	var force = req.query.force === 'yes' ? true : false;

	L.xi(req.txId, ['Solicitud de retransmisión de transmisión', txId, force]);


	Imongo.findTxById(req.txId, txId, function(err, dbTx) {
		if (err) {
			// TODO: Diferenciar entre error MDB o error de entrada (tx no es OID)
			var error = new FedicomError('WD-ERR-001', err, 400);
			var responseBody = error.send(res);
			Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.PETICION_INCORRECTA);
			return;
		}

		L.xi(req.txId, ['Se recupera la transmisión de la base de datos', dbTx]);

		// OK - La transmisión existe
		if (dbTx) {

			// Solo retransmitimos PEDIDOS
			if (dbTx.type !== txTypes.CREAR_PEDIDO) {
				L.xw(req.txId, ['No se retransmite la petición porque no es de tipo CREAR PEDIDO', dbTx.type]);
				var fedicomError = new FedicomError('WD-HTTP-409', 'Solo se admiten retransmisiones de pedidos', 409);
				var responseBody = fedicomError.send(res);
				Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.RETRANSMISION_IMPOSIBLE);
				return;
			}

			// Comprobacion de que el estado del pedido es válido para retransmi
			switch (dbTx.status) {
				case txStatus.OK:
				case txStatus.ESPERANDO_NUMERO_PEDIDO:
				case txStatus.FALLO_AUTENTICACION:
				case txStatus.PETICION_INCORRECTA:
				case txStatus.RECHAZADO_SAP:
					if (force) break;
					L.xw(req.txId, ['No se retransmite la petición porque no está en error y no se está forzando', dbTx.status]);
					var fedicomError = new FedicomError('WD-HTTP-409', 'No se retransmite la petición porque no está en error y no se está forzando', 409);
					var responseBody = fedicomError.send(res);
					Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.RETRANSMISION_SOLO_FORZANDO);
					return;
				case txStatus.RECEPCIONADO:
				case txStatus.ESPERANDO_INCIDENCIAS:
				case txStatus.INCIDENCIAS_RECIBIDAS:
				case txStatus.NO_SAP:
				case txStatus.ERROR_INTERNO:
				case txStatus.SISTEMA_SAP_NO_DEFINIDO:
					L.xd(req.txId, ['El estado de la transmisión es válido y será retransmitida a SAP', dbTx.status]);
					break;
				default:
					L.xw(req.txId, ['El estado de la transmisión no admite retransmitirla', dbTx.status]);
					var fedicomError = new FedicomError('WD-HTTP-409', 'El estado de la transmisión no admite retransmitirla', 409);
					var responseBody = fedicomError.send(res);
					Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.RETRANSMISION_IMPOSIBLE);
					return;
			}

			var pedido = null;
			try {
				dbTx.clientRequest.txId = req.txId;
				dbTx.clientRequest.token = dbTx.clientRequest.authentication;
		  		var pedido = new Pedido(dbTx.clientRequest);
			} catch (ex) {
				var responseBody = controllerHelper.sendException(ex, req, res);
				Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.PETICION_INCORRECTA);
				return;
			}
			L.xd(req.txId, ['El contenido de la transmisión es un pedido correcto, continuamos con la retransmisión', pedido]);


			Isap.realizarPedido( req.txId, pedido, function(sapErr, sapRes, sapBody, abort) {
				if (sapErr) {
					if (abort) {
						var fedicomError = new FedicomError('HTTP-400', sapErr, 400);
						var responseBody = fedicomError.send(res);
						Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.SISTEMA_SAP_NO_DEFINIDO);
					} else {
						L.xe(req.txId, ['Incidencia en la comunicación con SAP', sapErr]);
						pedido.simulaFaltas();
						res.status(201).json(pedido);
						Events.retransmit.emitRetransmit(req, res, pedido, dbTx, txStatus.NO_SAP);
					}
					return;
				}


				var response = sanitizeSapResponse(sapBody, pedido);

				if (Array.isArray(response)) {
					res.status(409).json(response);
					Events.retransmit.emitRetransmit(req, res, response, dbTx, txStatus.RECHAZADO_SAP);
				} else {
					res.status(201).json(response);
					Events.retransmit.emitRetransmit(req, res, response, dbTx, txStatus.ESPERANDO_NUMERO_PEDIDO);
				}
			});
		} else {
			var error = new FedicomError('WD-ERR-002', 'La transmisión no existe', 404);
			var responseBody = error.send(res);
			Events.retransmit.emitRetransmit(req, res, responseBody, dbTx, txStatus.PETICION_INCORRECTA);
		}
	});


}
