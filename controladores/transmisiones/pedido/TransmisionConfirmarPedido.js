'use strict';
const C = global.C;
const K = global.K;
const M = global.M;


const Transmision = require('modelos/transmision/Transmision');

const PostTransmision = require('modelos/transmision/PostTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionConfirmarPedido extends Transmision {

	metadatos = {							// Metadatos
		estadoTransmisionPedido: null,		// (int) El estado al que se mueve la transmisión de pedido que se está confirmando con esta transmisión
		idTransmisionPedido: null			// (ObjectID) El ID de la transisión que se está confirmando.
	};


	pedidosAsociadosSap;
	crcSap;


	// @Override
	async operar() {
		let json = this.req.body;

		if (Array.isArray(json.sap_pedidosasociados) && json.sap_pedidosasociados.length) {
			let setPedidosSap = new Set();
			json.sap_pedidosasociados.forEach(numeroPedidoSap => {
				let pedidoInt = parseInt(numeroPedidoSap);
				if (pedidoInt) setPedidosSap.add(pedidoInt);
			});
			this.pedidosAsociadosSap = Array.from(setPedidosSap);
		} else {
			this.pedidosAsociadosSap = [];
		}

		this.crcSap = parseInt(json.crc, 16) || 0;

		if (this.pedidosAsociadosSap.length > 0) {
			this.log.info(`SAP confirma la creación del pedido con CRC '${json.crc.toUpperCase()}' los siguientes números de pedido:`, this.pedidosAsociadosSap);
			this.metadatos.estadoTransmisionPedido = K.ESTADOS.COMPLETADO;
		} else {
			this.log.warn(`SAP no indica ningún número de pedido para la transmisión con CRC ${json.crc}`);
			this.metadatos.estadoTransmisionPedido = K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		}

		return await this.#confirmarCreacionDePedido();

	}

	async #confirmarCreacionDePedido() {

		// Buscamos pedidos que no sean antiguos.
		// Ponemos el mismo límite que se usa a la hora de determinar si un pedido es duplicado
		let fechaLimite = new Date();
		fechaLimite.setTime(fechaLimite.getTime() - C.pedidos.antiguedadDuplicadosMaxima);

		let consulta = {
			tipo: K.TIPOS.CREAR_PEDIDO,
			fechaCreacion: { $gt: fechaLimite },
			'pedido.crcSap': this.crcSap
		};


		try {
			let transmisionPedidoConfirmada = await PostTransmision.instanciar(consulta);
			this.metadatos.idTransmisionPedido = transmisionPedidoConfirmada.txId;

			transmisionPedidoConfirmada.setEstado(this.metadatos.estadoTransmisionPedido);
			if (this.pedidosAsociadosSap?.length) {
				transmisionPedidoConfirmada.setMetadatosOperacion('pedido', {
					pedidosAsociadosSap: this.pedidosAsociadosSap.map(nPed => M.toMongoLong(nPed))
				});
			}
			await transmisionPedidoConfirmada.actualizarTransmision();

		} catch (errorPostTransmision) {
			this.log.err('Ocurrió un error al instanciar la transmisión a confirmar', errorPostTransmision);
			return new ResultadoTransmision(200, K.ESTADOS.CONFIRMAR_PEDIDO.NO_ASOCIADA_A_PEDIDO, { ok: true });
		}


		return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, { ok: true });

	}



	// @Override
	generarMetadatosOperacion() {
		let metadatos = {
			crcSap: M.toMongoLong(this.crcSap),
			idPedidoConfirmado: this.metadatos.idTransmisionPedido
		};
		this.setMetadatosOperacion('pedido.confirmar', metadatos);
	}
}



TransmisionConfirmarPedido.TIPO = K.TIPOS.CONFIRMAR_PEDIDO;
TransmisionConfirmarPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion();

module.exports = TransmisionConfirmarPedido;