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

const retransmit = function (myId, retransmitId, force, cb) {

		Imongo.findTxById(myId, retransmitId, function(err, dbTx) {
			if (err) {
				L.xe(myId, ['Ocurrió un error al recuperar la transmisión de la base de datos', err], 'txRetransmit');
				var error = new FedicomError('WD-ERR-001', err, 400);
				Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.PETICION_INCORRECTA, null, false);
				cb(error, txStatus.PETICION_INCORRECTA);
				return;
			}

			L.xi(myId, ['Se recupera la transmisión de la base de datos', dbTx], 'txRetransmit');

			// OK - La transmisión existe
			if (dbTx) {

				// Solo retransmitimos PEDIDOS
				if (dbTx.type !== txTypes.CREAR_PEDIDO) {
					L.xw(myId, ['No se retransmite la petición porque no es de tipo CREAR PEDIDO', dbTx.type], 'txRetransmit');
					var error = new FedicomError('WD-HTTP-409', 'Solo se admiten retransmisiones de pedidos', 409);
					Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.RETRANSMISION_IMPOSIBLE, error.getErrors(), false);
					cb(error, txStatus.RETRANSMISION_IMPOSIBLE);
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
						L.xw(myId, ['No se retransmite la petición porque no está en error y no se está forzando', dbTx.status], 'txRetransmit');
						var error = new FedicomError('WD-HTTP-409', 'No se retransmite la petición porque no está en error y no se está forzando', 409);
						Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.RETRANSMISION_SOLO_FORZANDO, error.getErrors(), false);
						cb(error, txStatus.RETRANSMISION_SOLO_FORZANDO);
						return;
					case txStatus.RECEPCIONADO:
					case txStatus.ESPERANDO_INCIDENCIAS:
					case txStatus.INCIDENCIAS_RECIBIDAS:
					case txStatus.NO_SAP:
					case txStatus.ERROR_INTERNO:
					case txStatus.SISTEMA_SAP_NO_DEFINIDO:
						L.xd(myId, ['El estado de la transmisión es válido y será retransmitida a SAP', dbTx.status], 'txRetransmit');
						break;
					default:
						L.xw(myId, ['El estado de la transmisión no admite retransmitirla', dbTx.status], 'txRetransmit');
						var error = new FedicomError('WD-HTTP-409', 'El estado de la transmisión no admite retransmitirla', 409);
						Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.RETRANSMISION_IMPOSIBLE, error.getErrors(), false);
						// cb(error, dbTx, txStatus.RETRANSMISION_IMPOSIBLE);
						return;
				}

				var pedido = null;
				try {
					dbTx.clientRequest.txId = myId;
					dbTx.clientRequest.token = dbTx.clientRequest.authentication;
			  		var pedido = new Pedido(dbTx.clientRequest);
				} catch (error) {
					L.xe(myId, ['El contenido de la transmisión no es correcto - Se aborta la retransmisión', error], 'txRetransmit');
					var responseBody = (error.send) ? error.getErrors() : (new FedicomError('HTTP-500', 'Error interno del servidor - ' + myId, 500)).getErrors();
					Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.PETICION_INCORRECTA, responseBody, false);
					cb(error, txStatus.PETICION_INCORRECTA);
					return;
				}
				L.xd(myId, ['El contenido de la transmisión es un pedido correcto, continuamos con la retransmisión', pedido], 'txRetransmit');


				Isap.realizarPedido( myId, pedido, function(sapErr, sapRes, sapBody, abort) {
					if (sapErr) {
						if (abort) {
							L.xe(myId, ['El sistema SAP no está definido - Imposible retransmitir'], 'txRetransmit');
							var error = new FedicomError('HTTP-400', sapErr, 400);
							Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.SISTEMA_SAP_NO_DEFINIDO, error.getErrors(), false);
							cb(error, txStatus.SISTEMA_SAP_NO_DEFINIDO);
						} else {
							L.xe(myId, ['Incidencia en la comunicación con SAP', sapErr], 'txRetransmit');
							var responseBody = (sapErr.send) ? sapErr.getErrors() : (new FedicomError('HTTP-500', 'Error interno del servidor - ' + myId, 500)).getErrors();
							Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.NO_SAP, responseBody, false);
							cb(sapErr, txStatus.NO_SAP);
						}
						return;
					}

					var response = sanitizeSapResponse(sapBody, pedido);

					if (Array.isArray(response)) {
						L.xi(myId, ['Pedido retransmitido a SAP', txStatus.RECHAZADO_SAP], 'txRetransmit');
						Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.RECHAZADO_SAP, response, false);
						cb(null, txStatus.RECHAZADO_SAP, response);
					} else {
						L.xi(myId, ['Pedido retransmitido a SAP', txStatus.ESPERANDO_NUMERO_PEDIDO], 'txRetransmit');
						Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.ESPERANDO_NUMERO_PEDIDO, response, false);
						cb(null, txStatus.ESPERANDO_NUMERO_PEDIDO, response);
					}
				});
			} else {
				var error = new FedicomError('WD-ERR-002', 'La transmisión no existe', 404);
				Events.retransmit.emitAutoRetransmit(myId, dbTx, txStatus.PETICION_INCORRECTA, error.getErrors(), false);
				cb(error, txStatus.PETICION_INCORRECTA);
			}
		});
};

module.exports = retransmit;
