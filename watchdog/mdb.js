'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;



// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iSap = require('interfaces/isap/iSap');
const iEventos = require('interfaces/eventos/iEventos');
const iFlags = require('interfaces/iFlags');
const iRegistroProcesos = require('interfaces/procesos/iRegistroProcesos');

// Helpers
const retransmitirPedido = require('watchdog/retransmitirPedido').retransmitirPedido;
const configuracionWatchdowgMDB = C.watchdog.mdbwatch;


let numeroRetransmisionesEnProgreso = 0;
let intervaloEnEjecucion = false;



/*let interval = */
setInterval(() => {

	// TODO: Interesante no hacer recovery de transmisiones si hay datos pendientes de escribir en SQLite
	if (numeroRetransmisionesEnProgreso || intervaloEnEjecucion) {
		L.t(['Ya existe otro intervalo en ejecucion', numeroRetransmisionesEnProgreso, intervaloEnEjecucion], 'mdbwatch');
		return;
	}

	L.t('Arranco intervalo. Voy a comprobar si soy maestro');
	intervaloEnEjecucion = true;

	iRegistroProcesos.soyMaestro(K.PROCESS_TYPES.WATCHDOG, (err, maestro) => {
		if (err) {
			L.e(['Ocurrió un error al comprobar si el watchdog es el maestro', err], 'mdbwatch');
			intervaloEnEjecucion = false;
			return;
		}

		if (maestro) {
			L.t(['Soy el proceso maestro, paso a consultar transmisiones candidatas a ser retrasnmitidas'], 'mdbwatch');
			iMongo.consultaTx.candidatasParaRetransmitir(configuracionWatchdowgMDB.buffer_size || 10, configuracionWatchdowgMDB.minimum_age || 300, (errorMongo, candidatos) => {

				if (errorMongo) {
					L.e(['Error al obtener lista de transmisiones recuperables', errorMongo], 'mdbwatch');
					intervaloEnEjecucion = false;
					return;
				}

				L.t(['Candidatos a retransmitir', candidatos.length], 'mdbwatch');

				if (candidatos && candidatos.length > 0) {
					L.i('Se encontraron ' + candidatos.length + ' transmisiones recuperables', 'mdbwatch');

					L.t(['Haciendo PING a SAP'], 'mdbwatch');
					iSap.ping(null, (sapError, sapStatus) => {
						if (sapError) {
							L.i(['Aún no se ha recuperado la comunicación con SAP', sapError], 'mdbwatch');
							intervaloEnEjecucion = false;
							return;
						}

						if (sapStatus) {

							L.i(['SAP indica que está listo para recibir pedidos, procedemos a mandar la tanda'], 'mdbwatch');

							candidatos.forEach((dbTx) => {

								let txId = dbTx._id;
								numeroRetransmisionesEnProgreso++;

								L.xt(txId, ['La transmisión ha sido identificada como recuperable'], 'mdbwatch');

								// CASO TIPICO: No ha entrado a SAP
								if (dbTx.status === K.TX_STATUS.NO_SAP) {
									L.xi(txId, 'Retransmitiendo pedido por encontrarse en estado NO_SAP', 'mdbwatch');
									retransmitirPedido(txId, null, (err, rtxId) => {
										numeroRetransmisionesEnProgreso--;
									});
									return;
								}
								// CASO CONGESTION: SAP da numero de pedido antes que MDB haga commit
								else if (dbTx.status === K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO && dbTx.sapConfirms) {
									L.xi(txId, 'Recuperando estado de pedido ya que existe confirmación del mismo por SAP', 'mdbwatch');
									iFlags.set(txId, C.flags.STATUS_FIX1);
									iEventos.retransmisiones.cambioEstado(txId, K.TX_STATUS.OK);
									numeroRetransmisionesEnProgreso--;
									return;
								}
								// SAP NO DA CONFIRMACION
								else if (dbTx.status === K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO) {

									/**
									 * Si la transmisión no está confirmada, existe la posibilidad de que SAP realmente si que haya confirmado
									 * la transmisión, pero esta no se haya actualizado. Por ejemplo, en casos de congestión, puede que el commit
									 * de la confirmación se procese antes que el de la propia transmisión, lo que deja a la confirmación en el 
									 * estado NO_EXISTE_PEDIDO o ERROR_INTERNO.
									 */
									L.xi(txId, 'Pedido sin confirmar por SAP - Buscamos si hay confirmación perdida para el mismo', 'mdbwatch');
									let crc = dbTx.crc.toHexString().substr(0, 8);
									iMongo.consultaTx.porCRCDeConfirmacion(crc, (errorMongo, confirmacionPedido) => {
										// Error al consultar a MDB - Sigue habiendo problemas, nos estamos quietos por el momento
										if (errorMongo) {
											L.xi(txId, ['Error al buscar la confirmación del pedido - Abortamos recuperación', errorMongo], 'mdbwatch');
											numeroRetransmisionesEnProgreso--;
											return;
										}
										// No hay confirmación, la transmisión se pone en estado de ESPERA_AGOTADA.
										// Puede ser retransmitida manualmente mas adelante.
										if (!confirmacionPedido || !confirmacionPedido.clientRequest || !confirmacionPedido.clientRequest.body) {
											L.xw(txId, 'No hay confirmación y se agotó la espera de la confirmación del pedido', 'mdbwatch');
											iFlags.set(txId, C.flags.STATUS_FIX2);
											iEventos.retransmisiones.cambioEstado(txId, K.TX_STATUS.PEDIDO.ESPERA_AGOTADA);
											numeroRetransmisionesEnProgreso--;
											return;
										}

										// Tenemos la transmisión de confirmación. Hay que actualizar la transmisión del pedido original para reflejarlo.
										L.xi(txId, ['Se procede a recuperar el pedido en base a la confirmacion de SAP con ID ' + confirmacionPedido._id], 'mdbwatch');
										iFlags.set(txId, C.flags.STATUS_FIX3);
										iEventos.retransmisiones.asociarConfirmacionConPedido(txId, confirmacionPedido);
										numeroRetransmisionesEnProgreso--;
										return;

									});

								}
								// CASO ERROR: La transmisión falló durante el proceso
								else {
									L.xi(txId, 'La transmisión está en un estado inconsistente - La retransmitimos a SAP', 'mdbwatch');

									retransmitirPedido(txId, null, (err, rtxId) => {
										numeroRetransmisionesEnProgreso--;
									});
									return;
								}
							});

							intervaloEnEjecucion = false;
						} else {
							L.i(['SAP indica que no está listo para recibir pedidos'], 'mdbwatch');
							intervaloEnEjecucion = false;
						}
					});
				} else {
					L.t(['No se encontraron candidatos a retransmitir'], 'mdbwatch');
					intervaloEnEjecucion = false;
				}

			});
		} else {
			L.t(['No soy maestro'], 'mdbwatch');
			intervaloEnEjecucion = false;
			// No soy maestro, no hago nada.
		}

	});
}, ((configuracionWatchdowgMDB.interval || 5) * 1000));
