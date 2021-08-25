'use strict';
const K = global.K;
const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const PostTransmision = require('modelos/transmision/PostTransmision');
const TransmisionCrearPedido = require('controladores/transmisiones/pedido/TransmisionCrearPedido');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class RetransmisionPedido extends Transmision {

	// @Override
	async operar() {

		let txId = this.req.params.txId;

		try {
			let oid = M.ObjectID.createFromHexString(txId);
			let postTransmision = await PostTransmision.instanciar({ _id: oid}, true);
			let {req, res} = await postTransmision.prepararReejecucion();
			let reTransmision = await Transmision.ejecutar(req, res, TransmisionCrearPedido, { retransmision: oid })

			// Actualizamos la transmision original, indicando la nueva retransmisión que se ha hecho sobre la misma
			postTransmision.setMetadatosOperacion('pedido.retransmisiones', reTransmision.txId, '$push');
			/*await*/ postTransmision.actualizarTransmision();

			
			return new ResultadoTransmision(200, K.ESTADOS.NO_CONTROLADA, postTransmision.getDatos())
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision(K.ESTADOS.NO_CONTROLADA);
		}
	}

	// @Override
	generarMetadatosOperacion() {
		// noop
	}
}



RetransmisionPedido.TIPO = K.TIPOS.NO_CONTROLADA;
RetransmisionPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: 'FED3_RETRANSMISOR',
	simulaciones: false,
	simulacionesEnProduccion: false
});


module.exports = RetransmisionPedido;