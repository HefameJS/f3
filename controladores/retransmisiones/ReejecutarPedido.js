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
class ReejecutarPedido extends Transmision {

	// @Override
	async operar() {

		let txId = this.req.params.txId;
		let modificaciones = this.#sanearModificaciones();

		L.info(`Solicitud de reejecución del pedido con ID ${txId} con modificaciones:`, modificaciones);

		try {
			let oid = M.ObjectID.createFromHexString(txId);
			let postTransmision = await PostTransmision.instanciar({ _id: oid}, true);
			let {req, res} = await postTransmision.prepararReejecucion();

			this.#aplicarModificaciones(req, modificaciones);

			let reTransmision = await Transmision.ejecutar(req, res, TransmisionCrearPedido, { idTransmisionOriginal: oid, modificaciones })

			// Actualizamos la transmision original, indicando la nueva retransmisión que se ha hecho sobre la misma
			postTransmision.setMetadatosOperacion('pedido.reejecuciones', reTransmision.txId, '$push');
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

	/**
	 * Analiza el body con las modificaciones solicitadas, lo sanea y lo devuelve saneado.
	 * En caso de no haber modificaciones, devuelve null.
	 */
	#sanearModificaciones() {
		let modificacionesPropuestas = this.req.body;
		let modificaciones = {
			generarCrcUnico: false
		};
		
		if (modificacionesPropuestas.generarCrcUnico) modificaciones.generarCrcUnico = true;

		if (modificacionesPropuestas.tipoPedido) {
			modificaciones.tipoPedido = modificacionesPropuestas.tipoPedido;
			modificaciones.generarCrcUnico = true;
		}
		if (modificacionesPropuestas.codigoAlmacenServicio) {
			modificaciones.codigoAlmacenServicio = modificacionesPropuestas.codigoAlmacenServicio;
			modificaciones.generarCrcUnico = true;
		}

		if (modificaciones.generarCrcUnico) return modificaciones;
		return null;
	}

	#aplicarModificaciones(req, modificaciones) {
		if (!modificaciones) return;

		if (modificaciones.tipoPedido) req.body.tipoPedido = modificaciones.tipoPedido
		if (modificaciones.codigoAlmacenServicio) req.body.codigoAlmacenServicio = modificaciones.codigoAlmacenServicio
		return req;
	}
}



ReejecutarPedido.TIPO = K.TIPOS.NO_CONTROLADA;
ReejecutarPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: 'FED3_RETRANSMISOR',
	simulaciones: false,
	simulacionesEnProduccion: false
});


module.exports = ReejecutarPedido;