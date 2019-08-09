'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;


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
	Imongo.findCandidatosRetransmision(5, function(err, candidatos)  {
		retransmissionSearch = false;

		if (err) {
			console.log(err);
			return;
		}

		if (candidatos && candidatos.length > 0) {
			candidatos.forEach( function(tx) {
				var myId = new ObjectID();

				// CASO TIPICO: No ha entrado a SAP
				if (tx.status === txStatus.NO_SAP) {
					console.log(tx._id + " relanzamos pedido NO_SAP!!!!!");
					retransmissionsInProgress++;
					retransmit(myId, tx._id, false, function(err, newStatus, newBody) {
						retransmissionsInProgress--;
					});
					return;
				}
				// CASO CONGESTION: SAP da numero de pedido antes que MDB haga commit
				else if (tx.sapConfirms) {
					console.log(tx._id + " ARREGLAMOS ESTADO A OK");
					return Events.retransmit.emitStatusFix(myId, tx, txStatus.OK);
				}
				else if (tx.status === txStatus.ESPERANDO_NUMERO_PEDIDO) {
					console.log(tx._id + " ARREGLAMOS ESTADO A ESPERA_AGOTADA");
					return Events.retransmit.emitStatusFix(myId, tx, txStatus.ESPERA_AGOTADA);
				}
				// CASO ERROR: La transmisión falló durante el proceso
				else {
					console.log(tx._id + " FORZAMOS relanzar pedido !!!!!");
					retransmissionsInProgress++;
					retransmit(myId, tx._id, true, function(err, newStatus, newBody) {
						retransmissionsInProgress--;
					});
					return;
				}
			});
		}

	});

}, 1000);
