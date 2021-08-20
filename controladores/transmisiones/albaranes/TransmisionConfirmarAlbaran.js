'use strict';
const K = global.K;
const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const SolicitudConfirmacionAlbaran = require('../../../modelos/confirmacionAlbaran/SolicitudConfirmacionAlbaran');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionConfirmarAlbaran extends Transmision {

	metadatos = {
	}

	#solicitud;

	// @Override
	async operar() {

		this.#solicitud = new SolicitudConfirmacionAlbaran(this);

		if (this.#solicitud.tieneErrores()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitud.generarJSON('errores'));
		}

		return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, this.#solicitud.generarJSON('errores'));
	}


	// @Override
	generarMetadatosOperacion() {
		let metadatos = {}
		if (this.#solicitud.numeroAlbaran) metadatos.numeroAlbaran = M.toMongoLong(parseInt(this.#solicitud.numeroAlbaran))
		metadatos.totales = this.#solicitud.metadatos.totales;
		this.setMetadatosOperacion('albaran.confirmar', metadatos);
	}
}



TransmisionConfirmarAlbaran.TIPO = K.TIPOS.CONFIRMAR_ALBARAN;
TransmisionConfirmarAlbaran.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: false,
});


module.exports = TransmisionConfirmarAlbaran;