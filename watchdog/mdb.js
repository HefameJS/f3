'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;
const mdbwatchConfig = config.watchdog.mdbwatch;

const Imongo = require(BASE + 'interfaces/imongo');
const Events = require(BASE + 'interfaces/events');
const ObjectID = Imongo.ObjectID;

const txStatus = require(BASE + 'model/static/txStatus');
const retransmit = require(BASE + 'watchdog/retransmit');


var retransmissionsInProgress = 0;
var retransmissionSearch = false;


var interval = setInterval(function() {

	// TODO: Interesante no hacer recovery de transmisiones si hay datos pendientes de escribir en SQLite
	if (retransmissionsInProgress || retransmissionSearch) return;

	retransmissionSearch = true;
	Imongo.findCandidatosRetransmision(mdbwatchConfig.buffer_size || 10, mdbwatchConfig.minimum_age || 600, function(err, candidatos)  {
		retransmissionSearch = false;

		if (err) {
			L.e(['Error al obtener lista de transmisiones recuperables', err], 'mdbwatch');
			return;
		}

		if (candidatos && candidatos.length > 0) {
			L.i('Se encontraron ' + candidatos.length + ' transmisiones recuperables', 'mdbwatch');
			candidatos.forEach( function(tx) {
				var myId = new ObjectID();

				L.xt(tx._id, ['Transmisión marcada como recuperable', myId, tx], 'mdbwatch');

				// CASO TIPICO: No ha entrado a SAP
				if (tx.status === txStatus.NO_SAP) {
					L.xi(tx._id, 'Retransmitiendo pedido por encontrarse en estado NO_SAP', 'mdbwatch');
					retransmissionsInProgress++;
					retransmit(myId, tx._id, false, function(err, newStatus, newBody) {
						retransmissionsInProgress--;
					});
					return;
				}
				// CASO CONGESTION: SAP da numero de pedido antes que MDB haga commit
				else if (tx.status === txStatus.ESPERANDO_NUMERO_PEDIDO && tx.sapConfirms) {
					L.xi(tx._id, 'Recuperando estado de pedido ya que existe confirmación del mismo por SAP', 'mdbwatch');
					return Events.retransmit.emitStatusFix(myId, tx, txStatus.OK);
				}
				// SAP NO DA CONFIRMACION
				else if (tx.status === txStatus.ESPERANDO_NUMERO_PEDIDO) {

					// 1. Buscamos la tx de confirmacion del pedido con el CRC del pedido
					L.xi(tx._id, 'Pedido sin confirmar por SAP - Buscamos si hay confirmación perdida para el mismo', 'mdbwatch');
					retransmissionsInProgress++;
					Imongo.findConfirmacionPedidoByCRC(tx._id, tx.crc.toHexString().substr(0,8), function(err, confirmacionPedido) {
						// 1.1. Error al consultar a MDB - Sigue habiendo problemas, nos estamos quietos
						if (err) {
							L.xi(tx._id, 'Error al buscar la confirmación del pedido - Abortamos recuperación', 'mdbwatch');
							retransmissionsInProgress--;
							return;
						}
						// 1.2. Ya ha vuelto MDB, pero no hay confirmación
						if (!confirmacionPedido || !confirmacionPedido.clientRequest || !confirmacionPedido.clientRequest.body) {
							L.xw(tx._id, 'No hay confirmación y se agotó la espera de la confirmación del pedido', 'mdbwatch');
							Events.retransmit.emitStatusFix(myId, tx, txStatus.ESPERA_AGOTADA);
							retransmissionsInProgress--;
							return;
						}

						L.xi(tx._id, 'Se procede a recuperar el pedido en base a la confirmacion de SAP', 'mdbwatch');
						Events.retransmit.emitRecoverConfirmacionPedido(tx, confirmacionPedido);
						retransmissionsInProgress--;
						return;

					});

				}
				// CASO ERROR: La transmisión falló durante el proceso
				else {
					L.xi(tx._id, 'La transmisión está en un estado inconsistente - La retransmitimos', 'mdbwatch');
					retransmissionsInProgress++;
					retransmit(myId, tx._id, true, function(err, newStatus, newBody) {
						retransmissionsInProgress--;
					});
					return;
				}
			});
		} /* else {
			 L.t('No se encontraron candidatos a retransmitir', 'mdbwatch');
		} */

	});

}, ( (mdbwatchConfig.interval || 5) * 1000) );
