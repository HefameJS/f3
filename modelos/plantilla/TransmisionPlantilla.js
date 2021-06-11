'use strict';
//const C = global.config;
//const L = global.logger;
const K = global.constants;
//const M = global.mongodb;



const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionPlantilla extends Transmision {

	// @Override
	async operar() {
		let errorFedicom = new ErrorFedicom('ERR-PLANTILLA', 'Esta transmisión usa la plantilla y no hace nada', 503);
		
		return errorFedicom.generarResultadoTransmision();
		// o
		return new ResultadoTransmision(200, K.ESTADOS.ERROR_GENERICO, cuerpoRespuestaHttp);
	}

	// @Override
	generarMetadatosOperacion() {
		let metadatos = {plantilla: true}
		this.setMetadatosOperacion('plantilla', metadatos);
	}

}


TransmisionPlantilla.TIPO = K.TIPOS.PLANTILLA;
TransmisionPlantilla.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: false,
	simulacionesEnProduccion: false
});


module.exports = TransmisionPlantilla;