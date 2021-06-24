'use strict';
const C = global.config;
const K = global.constants;
const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionError extends Transmision {

	metadatos = {
	}

	// @Override
	async operar(datosDeOperacion) {

		if (!datosDeOperacion) datosDeOperacion = {}
		let {errorExpress, errorFedicom} = datosDeOperacion;

		if (errorExpress) {
			this.log.warn('Express ha reportado un error al analizar la trasmisión', errorExpress);
			return (new ErrorFedicom(errorExpress)).generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}

		if (errorFedicom) {
			this.log.warn('Se ha generado un error Fedicom analizar la trasmisión', errorFedicom);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}

		let error = new ErrorFedicom('HTTP-500', 'No se pudo procesar la transmisión', 500);
		return error.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		
	}


	// @Override
	generarMetadatosOperacion() {
		// noop
	}
}



TransmisionError.TIPO = K.TIPOS.RECHAZO;
TransmisionError.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: true,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionError;