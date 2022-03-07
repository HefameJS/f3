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
		crcSap: null						// (int64) El CRC indicado en SAP
	};

	pedidosAsociadosSap;
	idTransmisionConfirmada;


	// @Override
	async operar() {
		let json = this.req.body;

		// Si podemos sacar el CRC de SAP, lo registramos
		this.metadatos.crcSap = parseInt(json.crc, 16) || 0;

		// El txId a confirmar lo obtenemos de la URL
		if (!M.ObjectID.isValid(this.req.query.txId)) {
			this.log.err('El ID de la transmisión a confirmar no es válido: ', this.req.query.txId);
			return new ResultadoTransmision(200, K.ESTADOS.PETICION_INCORRECTA, { ok: true });
		}
		
		this.idTransmisionConfirmada = M.ObjectID.createFromHexString(this.req.query.txId);

		// Los numeros de pedido los obtenemos del body
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


		// Determinamos el estado del pedido en base a si se ha obtenido numero de pedido por parte de SAP o no
		if (this.pedidosAsociadosSap.length > 0) {
			this.log.info(`SAP confirma la creación del pedido en la transmisión de pedido con ID '${this.idTransmisionConfirmada}' los siguientes números de pedido:`, this.pedidosAsociadosSap);
			this.metadatos.estadoTransmisionPedido = K.ESTADOS.COMPLETADO;
		} else {
			this.log.warn(`SAP no indica ningún número de pedido para la transmisión de pedido con ID ${this.idTransmisionConfirmada}`);
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
			_id: this.idTransmisionConfirmada,
			tipo: K.TIPOS.CREAR_PEDIDO
		};


		try {
			let transmisionPedidoConfirmada = await PostTransmision.instanciar(consulta);

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
			crcSap: M.toMongoLong(this.metadatos.crcSap),
			idTransmisionConfirmada: this.idTransmisionConfirmada
		};
		this.setMetadatosOperacion('pedido.confirmar', metadatos);
	}

	// @Override
	generarMetadatosWebsocket() {

		let metadatos = {
			txIdConfirmada: this.idTransmisionConfirmada,
			nuevoEstado: this.metadatos.estadoTransmisionPedido,
			pedidosAsociadosSap: this.pedidosAsociadosSap
		};

		this.setMetadatosWebsocket(metadatos);
	}
}



TransmisionConfirmarPedido.TIPO = K.TIPOS.CONFIRMAR_PEDIDO;
TransmisionConfirmarPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion();

module.exports = TransmisionConfirmarPedido;