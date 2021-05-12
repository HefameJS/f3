'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;



// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iSap = require('interfaces/isap/iSap');
const iEventos = require('interfaces/eventos/iEventos');
const iFlags = require('interfaces/iflags/iFlags');

// Helpers
const retransmitirPedido = require('watchdog/retransmitirPedido').retransmitirPedido;



let numeroRetransmisionesEnProgreso = 0;
let intervaloEnEjecucion = false;




module.exports = () => {


	let idIntervalo = setInterval(async () => {

		if (numeroRetransmisionesEnProgreso || intervaloEnEjecucion) {
			// L.t(['Ya existe otro intervalo en ejecucion', numeroRetransmisionesEnProgreso, intervaloEnEjecucion]);
			return;
		}

		intervaloEnEjecucion = true;
		L.t('Arranco intervalo.');


		try {

			let candidatos = await iMongo.consultaTx.candidatasParaRetransmitir(
				C.watchdogPedidos.transmisionesSimultaneas, 
				C.watchdogPedidos.antiguedadMinima);

			L.t(['Candidatos a retransmitir', candidatos.length]);
			if (!candidatos || candidatos.length === 0) {
				intervaloEnEjecucion = false;
				return;
			}

			L.w(['Se han encontrado transmisiones para recuperar', candidatos.length]);

			L.t([`Lanzando ${C.watchdogPedidos.numeroPingsSap} PINGs a SAP con intervalo de ${C.watchdogPedidos.intervaloPingsSap} ms`]);

			for (let i = 0; i < C.watchdogPedidos.numeroPingsSap; i++) {
				let sapDisponible = await iSap.ping();
				if (!sapDisponible) {
					L.w(['SAP indica que no está disponible', i]);
					intervaloEnEjecucion = false;
					return;
				}
				L.t(['PING a SAP OK', i]);
				await (new Promise(resolve => setTimeout(() => resolve(true), C.watchdogPedidos.intervaloPingsSap)));

			}

			L.i(['SAP indica que está listo para recibir pedidos, procedemos a mandar la tanda']);

			candidatos.forEach(async (dbTx) => {

				let txId = dbTx._id;
				numeroRetransmisionesEnProgreso++;

				try {
					await M.col.tx.updateOne({ _id: new M.ObjectID(txId) }, { $inc: { intentosRetransmitir: 1 } });
					let intentosDeRetransmision = (await M.col.tx.findOne({ _id: new M.ObjectID(txId) }, { intentosRetransmitir: 1 })).intentosRetransmitir;
					L.xi(txId, ['El numero de retransmisiones de la transmision es', intentosDeRetransmision]);
					if (intentosDeRetransmision > C.watchdogPedidos.maximoReintentos) {
						L.xw(txId, ['Se ha alcanzado el número máximo de retransmisiones', intentosDeRetransmision]);
						iFlags.set(txId, C.flags.MAXIMO_RETRANSMISIONES_ALCANZADO);
						iEventos.retransmisiones.cambioEstado(txId, K.TX_STATUS.MAX_RETRANSMISIONES);
						numeroRetransmisionesEnProgreso--;
						return;s
					}
				} catch (errorMongo) {
					L.xe(txId, ['Error al consultar/incrementar el numero de reintentos de la transmision', errorMongo]);
					numeroRetransmisionesEnProgreso--;
					return;
				}


				L.xt(txId, ['La transmisión ha sido identificada como recuperable'], 'mdbwatch');



				// CASO TIPICO: No ha entrado a SAP
				if (dbTx.status === K.TX_STATUS.NO_SAP) {
					L.xi(txId, 'Retransmitiendo pedido por encontrarse en estado NO_SAP', 'mdbwatch');
					//
					retransmitirPedido(txId, null)
						.then(resultado => L.xi(txId, ['Resultado de la retransmisión', resultado]))
						.catch(error => L.xw(txId, ['Error en la retransmisión', error]))
						.finally(() => numeroRetransmisionesEnProgreso--);

				}
				// CASO CONGESTION: SAP da numero de pedido antes que MDB haga commit de la transmisión originaria
				else if (dbTx.status === K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO && dbTx.sapConfirms) {
					L.xi(txId, 'Recuperando estado de pedido ya que existe confirmación del mismo por SAP', 'mdbwatch');
					iFlags.set(txId, C.flags.STATUS_FIX1);
					iEventos.retransmisiones.cambioEstado(txId, K.TX_STATUS.OK);
					numeroRetransmisionesEnProgreso--;
					return;
				}
				// SAP NO DA CONFIRMACION
				else if (dbTx.status === K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO) {

					//
					// Si la transmisión no está confirmada, existe la posibilidad de que SAP realmente si que haya confirmado
					//* la transmisión, pero esta no se haya actualizado. Por ejemplo, en casos de congestión, puede que el commit
					//* de la confirmación se procese antes que el de la propia transmisión, lo que deja a la confirmación en el 
					//* estado NO_EXISTE_PEDIDO o ERROR_INTERNO.
					L.xi(txId, 'Pedido sin confirmar por SAP - Buscamos si hay confirmación perdida para el mismo', 'mdbwatch');
					iMongo.consultaTx.porCRCDeConfirmacion(dbTx.crcSap)
						.then((confirmacionPedido) => {
							// Si no hay confirmación, la transmisión se pone en estado de ESPERA_AGOTADA.
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
						}).catch((errorMongo) => {
							L.xi(txId, ['Error al buscar la confirmación del pedido - Abortamos recuperación', errorMongo], 'mdbwatch');
							numeroRetransmisionesEnProgreso--;
							return;
						});
				}
				// CASO ERROR: La transmisión falló durante el proceso
				else {
					L.xi(txId, 'La transmisión está en un estado inconsistente - La retransmitimos a SAP', 'mdbwatch');
					retransmitirPedido(txId, null)
						.then(resultado => L.xi(txId, ['Resultado de la retransmisión', resultado]))
						.catch(error => L.xw(txId, ['Error en la retransmisión', error]))
						.finally(() => numeroRetransmisionesEnProgreso--);
				}
			});

			intervaloEnEjecucion = false;

		} catch (errorMongo) {
			L.e(['Error al obtener lista de transmisiones recuperables', errorMongo]);
			intervaloEnEjecucion = false;
			return;
		}


	}, C.watchdogPedidos.intervalo)

	return idIntervalo;

}
