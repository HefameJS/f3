'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;



// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iSap = require(BASE + 'interfaces/isap/iSap');
const iEventos = require(BASE + 'interfaces/eventos/iEventos');
const iFlags = require(BASE + 'interfaces/iFlags');
const iRegistroProcesos = require(BASE + 'interfaces/procesos/iRegistroProcesos');

// Helpers
const retransmitirPedido = require(BASE + 'watchdog/retransmitirPedido').retransmitirPedido;
const configuracionWatchdowgMDB = C.watchdog.mdbwatch;


var retransmissionsInProgress = 0;
var retransmissionSearch = false;

var interval = setInterval(() =>  {

	// TODO: Interesante no hacer recovery de transmisiones si hay datos pendientes de escribir en SQLite
	if (retransmissionsInProgress || retransmissionSearch) return;


	iRegistroProcesos.soyMaestro(K.PROCESS_TYPES.WATCHDOG, (err, maestro) => {
		if (err) return;

		if (maestro) {
			retransmissionSearch = true;
			iMongo.consultaTx.candidatasParaRetransmitir(configuracionWatchdowgMDB.buffer_size || 10, configuracionWatchdowgMDB.minimum_age || 300, (err, candidatos) => {
				retransmissionSearch = false;

				if (err) {
					L.e(['Error al obtener lista de transmisiones recuperables', err], 'mdbwatch');
					return;
				}

				if (candidatos && candidatos.length > 0) {
					L.i('Se encontraron ' + candidatos.length + ' transmisiones recuperables', 'mdbwatch');

					iSap.ping(null, (sapError, sapStatus) => {
						if (sapStatus) {
							candidatos.forEach((tx) => {

								var txId = tx._id;

								L.xt(txId, ['La transmisión ha sido identificada como recuperable'], 'mdbwatch');

								// CASO TIPICO: No ha entrado a SAP
								if (tx.status === K.TX_STATUS.NO_SAP) {
									L.xi(txId, 'Retransmitiendo pedido por encontrarse en estado NO_SAP', 'mdbwatch');
									retransmissionsInProgress++;
									retransmitirPedido(txId, null, (err, rtxId) => {
										retransmissionsInProgress--;
									});
									return;
								}
								// CASO CONGESTION: SAP da numero de pedido antes que MDB haga commit
								else if (tx.status === K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO && tx.sapConfirms) {
									L.xi(txId, 'Recuperando estado de pedido ya que existe confirmación del mismo por SAP', 'mdbwatch');
									iFlags.set(txId, K.FLAGS.STATUS_FIX1);
									return iEventos.retransmisiones.emitStatusFix(txId, K.TX_STATUS.OK);
								}
								// SAP NO DA CONFIRMACION
								else if (tx.status === K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO) {

									/**
									 * Si la transmisión no está confirmada, existe la posibilidad de que SAP realmente si que haya confirmado
									 * la transmisión, pero esta no se haya actualizado. Por ejemplo, en casos de congestión, puede que el commit
									 * de la confirmación se procese antes que el de la propia transmisión, lo que deja a la confirmación en el 
									 * estado NO_EXISTE_PEDIDO o ERROR_INTERNO.
									 */
									L.xi(txId, 'Pedido sin confirmar por SAP - Buscamos si hay confirmación perdida para el mismo', 'mdbwatch');
									retransmissionsInProgress++;
									let crc = tx.crc.toHexString().substr(0, 8);
									iMongo.consultaTx.porCRCDeConfirmacion(crc, (errorMongo, confirmacionPedido) => {
										// Error al consultar a MDB - Sigue habiendo problemas, nos estamos quietos por el momento
										if (errorMongo) {
											L.xi(txId, ['Error al buscar la confirmación del pedido - Abortamos recuperación', errorMongo], 'mdbwatch');
											retransmissionsInProgress--;
											return;
										}
										// No hay confirmación, la transmisión se pone en estado de ESPERA_AGOTADA.
										// Puede ser retransmitida manualmente mas adelante.
										if (!confirmacionPedido || !confirmacionPedido.clientRequest || !confirmacionPedido.clientRequest.body) {
											L.xw(txId, 'No hay confirmación y se agotó la espera de la confirmación del pedido', 'mdbwatch');
											iFlags.set(txId, K.FLAGS.STATUS_FIX2);
											iEventos.retransmisiones.emitStatusFix(txId, K.TX_STATUS.PEDIDO.ESPERA_AGOTADA);
											retransmissionsInProgress--;
											return;
										}

										// Tenemos la transmisión de confirmación. Hay que actualizar la transmisión del pedido original para reflejarlo.
										L.xi(txId, ['Se procede a recuperar el pedido en base a la confirmacion de SAP con ID ' + confirmacionPedido._id], 'mdbwatch');
										iFlags.set(txId, K.FLAGS.STATUS_FIX3);
										iEventos.retransmisiones.emitRecoverConfirmacionPedido(txId, confirmacionPedido);
										retransmissionsInProgress--;
										return;

									});

								}
								// CASO ERROR: La transmisión falló durante el proceso
								else {
									L.xi(txId, 'La transmisión está en un estado inconsistente - La retransmitimos a SAP', 'mdbwatch');
									retransmissionsInProgress++;
									retransmitirPedido(txId, null, (err, rtxId) => {
										retransmissionsInProgress--;
									});
									return;
								}
							});
						} else {
							L.i(['Aún no se ha recuperado la comunicación con SAP', sapError], 'mdbwatch');
						}
					});
				} else {
					L.t(['No se encontraron candidatos a retransmitir'], 'mdbwatch');
				}

			});
		} else {

		}

	});
}, ((configuracionWatchdowgMDB.interval || 5) * 1000));
