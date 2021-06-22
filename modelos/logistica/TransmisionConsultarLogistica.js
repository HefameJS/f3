'use strict';
//const C = global.config;
const K = global.constants;
const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const toMongoLong = require("mongodb").Long.fromNumber;

/**
 */
class TransmisionConsultarLogistica extends Transmision {

	#metadatos = {							// Metadatos
		numeroLogistica: null
	}

	// @Override
	async operar() {

		this.#metadatos.numeroLogistica = parseInt(this.req.params?.numeroLogistica);


		if (!this.#metadatos.numeroLogistica) {
			this.log.warn('El número de logística indicado no es válido')
		}

		try {
			let consulta = {
				tipo: K.TIPOS.CREAR_LOGISTICA,
				'logistica.numeroLogistica': toMongoLong(this.#metadatos.numeroLogistica)
			}

			let respuestaLogistica = await M.col.transmisiones.findOne(consulta, {
				projection: {
					'_id': 1,
					'conexion.respuesta': 1
				}
			});

			if (respuestaLogistica?.conexion?.respuesta?.body) {
				this.log.info(`Recuperada la respuesta del pedido de logística con txId ${respuestaLogistica?._id}`);
				return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, respuestaLogistica.conexion.respuesta.body);
			} else {
				this.log.warn(`No se ha encontrado el pedido de logística`);
				let errorFedicom = new ErrorFedicom('LOG-ERR-000', 'El pedido de logística solicitado no existe', 404);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
			}

		} catch (errorMongo) {
			this.log.err('Ocurrió un error al localizar el pedido de logística en la base de datos', errorMongo);
			let errorFedicom = new ErrorFedicom('LOG-ERR-999', 'Ocurrió un error al recuperar el pedido de logística', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.ERROR);
		}
		
	}


	// @Override
	generarMetadatosOperacion() {
		if (this.#metadatos.numeroLogistica) {
			let metadatos = {
				numeroLogistica: toMongoLong(this.#metadatos.numeroLogistica)
			}
			this.setMetadatosOperacion('logistica.consultar', metadatos);
		}
		
	}
}



TransmisionConsultarLogistica.TIPO = K.TIPOS.CONSULTAR_LOGISTICA;
TransmisionConsultarLogistica.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionConsultarLogistica;