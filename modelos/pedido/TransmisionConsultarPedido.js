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
class TransmisionConsultarPedido extends Transmision {

	#metadatos = {							// Metadatos
		numeroPedido: null
	}

	// @Override
	async operar() {

		let numeroPedidoRecibido = this.req.params?.numeroPedido;

		if (!M.ObjectID.isValid(numeroPedidoRecibido)) {
			this.log.warn('El numero de pedido indicado no es un ObjectID válido');
			let errorFedicom = new ErrorFedicom('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}

		this.#metadatos.numeroPedido = new M.ObjectID(numeroPedidoRecibido);

		try {
			let consulta = {
				tipo: K.TIPOS.CREAR_PEDIDO,
				'pedido.crc': this.#metadatos.numeroPedido
			}

			let respuestaPedido = await M.col.transmisiones.findOne(consulta, {
				projection: {
					'_id': 1,
					'conexion.respuesta': 1
				}
			});

			if (respuestaPedido?.conexion?.respuesta?.body) {
				this.log.info(`Recuperada la respuesta del pedido con txId ${respuestaPedido?._id}`);
				return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, respuestaPedido.conexion.respuesta.body);
			} else {
				this.log.warn(`No se ha encontrado el pedido`);
				let errorFedicom = new ErrorFedicom('PED-ERR-001', 'El pedido solicitado no existe', 404);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
			}

		} catch (errorMongo) {
			this.log.err('Ocurrió un error al localizar el pedido en la base de datos', errorMongo);
			let errorFedicom = new ErrorFedicom('PED-ERR-999', 'Ocurrió un error al recuperar el pedido', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.ERROR);
		}
		
	}


	// @Override
	generarMetadatosOperacion() {
		if (this.#metadatos.numeroPedido) {
			let metadatos = {
				numeroPedido: this.#metadatos.numeroPedido
			}
			this.setMetadatosOperacion('pedido.consultar', metadatos);
		}
		
	}
}



TransmisionConsultarPedido.TIPO = K.TIPOS.CONSULTAR_PEDIDO;
TransmisionConsultarPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionConsultarPedido;