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

	if (retransmissionsInProgress || retransmissionSearch) return;

	retransmissionSearch = true;
	Imongo.findCandidatosRetransmision(mdbwatchConfig.buffer_size, mdbwatchConfig.minimum_age, function(err, candidatos)  {
		retransmissionSearch = false;

		if (err) {
			L.e(['Error al obtener lista de candidatos para retransmisión', err], 'mdbwatch');
			return;
		}

		if (candidatos && candidatos.length > 0) {
			L.i('Se encontraron ' + candidatos.length + ' para retransmitir a SAP', 'mdbwatch');
			candidatos.forEach( function(tx) {
				var myId = new ObjectID();

				L.xt(tx._id, ['Marcado como candidato', myId, tx], 'mdbwatch');

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
				else if (tx.sapConfirms) {
					L.xi(tx._id, 'Corrigiendo estado de pedido ya que existe confirmación del mismo por SAP', 'mdbwatch');
					return Events.retransmit.emitStatusFix(myId, tx, txStatus.OK);
				}
				else if (tx.status === txStatus.ESPERANDO_NUMERO_PEDIDO) {
					L.xw(tx._id, 'Se agotó la espera de la confirmación del pedido', 'mdbwatch');
					return Events.retransmit.emitStatusFix(myId, tx, txStatus.ESPERA_AGOTADA);
				}
				// CASO ERROR: La transmisión falló durante el proceso
				else {
					L.xi(tx._id, 'La transmisión está en un estadi inconsistente - La retransmitimos', 'mdbwatch');
					retransmissionsInProgress++;
					retransmit(myId, tx._id, true, function(err, newStatus, newBody) {
						retransmissionsInProgress--;
					});
					return;
				}
			});
		} /* else {
			 L.t('No se encontraron candidatos a retransmitir', 'mdbwatch');
		}*/

	});

}, (mdbwatchConfig.interval * 1000) );
