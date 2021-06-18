'use strict';
const C = global.config;
const K = global.constants;
//const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

let toMongoLong = require("mongodb").Long.fromNumber;
const SolicitudCrearPedido = require('./SolicitudCrearPedido');
const RespuestaPedidoSap = require('./RespuestaPedidoSap');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionCrearPedido extends Transmision {

	metadatos = {							// Metadatos
		noEnviaFaltas: false,				// Indica si no se enviaron faltas al cliente.
	};

	#solicitud;
	#respuesta;

	// @Override
	async operar() {
		this.#solicitud = new SolicitudCrearPedido(this);

		// PASO 1: Verificar si hay errores de protocolo
		if (this.#solicitud.contieneErroresProtocolo()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitud.generarJSON('errores'));
		}

		// PASO 2: Verificar si el pedido es duplicado
		if (await this.#solicitud.esDuplicado()) {
			return new ResultadoTransmision(400, K.ESTADOS.DUPLICADO, this.#solicitud.generarJSON('errores'));
		}

		// PASO 3: Enviamos el pedido a SAP a ver que devuelve 
		try {
			this.log.info('Procedemos a enviar a SAP el pedido');
			this.sap.setTimeout(C.sap.timeout.crearPedido);
			await this.sap.post('/api/zsd_ent_ped_api/pedidos', this.#solicitud.generarJSON('sap'));
			this.log.info('Obtenida respuesta de SAP, procedemos a analizarla');
		} catch (errorLlamadaSap) {
			this.log.err('Incidencia en la comunicación con SAP, se simulan las faltas del pedido', errorLlamadaSap);
			this.addError('PED-WARN-001', 'Su pedido se ha recibido correctamente, pero no hemos podido informar las faltas.');
			this.metadatos.noEnviaFaltas = true;
			return new ResultadoTransmision(201, K.ESTADOS.PEDIDO.NO_SAP, this.#solicitud.generarJSON('errores'));
		}

		// PASO 4: A ver que nos ha mandado SAP...
		return await this.#procesarResultadoSap();

	}

	async #procesarResultadoSap() {

		this.#respuesta = new RespuestaPedidoSap(this, this.#solicitud.metadatos.crc);

		// Si la respuesta de SAP es un array de incidencias, es un pedido rechazado por SAP
		// Sanearemos las mismas por si vienen errores de bloqueos.
		if (this.#respuesta.metadatos.esRespuestaDeErrores) {
			return new ResultadoTransmision(409, K.ESTADOS.PEDIDO.RECHAZADO_SAP, this.#respuesta.generarJSON());
		}

		// BUG: En ocasiones, SAP devolvía un string que no era un JSON. Esto parece que ya no ocurre con el cambio a 'axios'
		// pero dejamos la comprobación por si acaso
		if (this.#respuesta.metadatos.esRespuestaIncompresible) {
			this.log.err('SAP devuelve un cuerpo de respuesta que no es un objeto válido. Se devuelve error de faltas simuladas', cuerpoRespuestaSap);
			this.metadatos.noEnviaFaltas = true;
			return new ResultadoTransmision(409, K.ESTADOS.PEDIDO.NO_SAP, this.#solicitud.generarJSON('noSap'));
		}

		let respuestaCliente = this.#respuesta.generarJSON();
		let { codigoRetornoHttp, estadoTransmision } = this.#respuesta.determinarEstadoTransmision();
		return new ResultadoTransmision(codigoRetornoHttp, estadoTransmision, respuestaCliente);

	}

	// @Override
	generarMetadatosOperacion() {

		if (this.#solicitud.contieneErroresProtocoloEnCabecera()) {
			return;
		}

		let metadatos = {
			codigoCliente: parseInt(this.#solicitud.codigoCliente.slice(-5)) || this.codigoCliente,
			tipoPedido: parseInt(this.#solicitud.tipoPedido) || 0,
			crc: this.#solicitud.metadatos.crc,
			crcSap: toMongoLong(parseInt(this.#solicitud.metadatos.crc.toString().substring(0, 8), 16)),
			tipoCrc: this.#solicitud.metadatos.tipoCrc
		};

		if (this.metadatos.noEnviaFaltas) metadatos.noEnviaFaltas = true;

		if (this.#solicitud.metadatos.codigoAlmacenDesconocido) metadatos.codigoAlmacenDesconocido = true;
		if (this.#solicitud.metadatos.codigoAlmacenSaneado) metadatos.codigoAlmacenSaneado = true;
		if (this.#solicitud.metadatos.esRetransmisionCliente) metadatos.retransmisionCliente = true;
		if (this.#solicitud.metadatos.errorComprobacionDuplicado) metadatos.errorComprobacionDuplicado = true;
		

		if (this.#respuesta) {

			if (this.#respuesta.metadatos.erroresOcultados.tieneErrores()) metadatos.erroresOcultados = this.#respuesta.metadatos.erroresOcultados.getErrores();

			if (this.#respuesta.codigoAlmacenServicio) metadatos.codigoAlmacenServicio = this.#respuesta.codigoAlmacenServicio;

			if (this.#respuesta.metadatos.pedidoProcesadoSap) metadatos.pedidoProcesadoSap = true;
			if (this.#respuesta.metadatos.reboteFaltas) metadatos.reboteFaltas = true;
			if (this.#respuesta.metadatos.porRazonDesconocida) metadatos.porRazonDesconocida = true;
			if (this.#respuesta.metadatos.servicioDemorado) metadatos.servicioDemorado = true;
			if (this.#respuesta.metadatos.estupefaciente) metadatos.estupefaciente = true;
			if (this.#respuesta.metadatos.clienteBloqueadoSap) metadatos.clienteBloqueadoSap = true;


			if (this.#respuesta.metadatos.totales) metadatos.totales = this.#respuesta.metadatos.totales;
			if (this.#respuesta.metadatos.puntoEntrega) metadatos.puntoEntrega = this.#respuesta.metadatos.puntoEntrega;
			if (this.#respuesta.metadatos.tipoPedidoSap) metadatos.tipoPedidoSap = this.#respuesta.metadatos.tipoPedidoSap;
			if (this.#respuesta.metadatos.motivoPedidoSap) metadatos.motivoPedidoSap = this.#respuesta.metadatos.motivoPedidoSap;
			if (this.#respuesta.metadatos.clienteSap) metadatos.clienteSap = this.#respuesta.metadatos.clienteSap;

			if (this.#respuesta.metadatos.pedidosAsociadosSap?.length) metadatos.pedidosAsociadosSap = this.#respuesta.metadatos.pedidosAsociadosSap.map(nPed => toMongoLong(nPed));
			if (this.#respuesta.metadatos.pedidoAgrupadoSap) metadatos.pedidoAgrupadoSap = toMongoLong(this.#respuesta.metadatos.pedidoAgrupadoSap);

		}


		this.setMetadatosOperacion('pedido', metadatos);
	}
}



TransmisionCrearPedido.TIPO = K.TIPOS.CREAR_PEDIDO;
TransmisionCrearPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: false,
});


module.exports = TransmisionCrearPedido;