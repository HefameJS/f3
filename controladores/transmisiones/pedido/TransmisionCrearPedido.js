'use strict';
const C = global.C;
const K = global.K;
const M = global.M;
const Transmision = require('modelos/transmision/Transmision');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const SolicitudCrearPedido = require('modelos/pedido/SolicitudCrearPedido');
const RespuestaPedidoSap = require('modelos/pedido/RespuestaPedidoSap');
const PostTransmision = require('modelos/transmision/PostTransmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionCrearPedido extends Transmision {

	metadatos = {							// Metadatos
		noEnviaFaltas: false,				// Indica si no se enviaron faltas al cliente.
		opcionesDeReejecucion: null			// Indica cambios a realizar en el pedido en el caso de que sea una reejecución
	};

	#solicitud;
	#respuesta;

	// @Override
	async operar(datosExtra) {

		/**
		 * Datos extra:
		 * - opcionesDeReejecucion: Indica las opciones de reejecución que se hayan realizado sobre el pedido original
		 */
		this.metadatos.opcionesDeReejecucion = datosExtra?.opcionesDeReejecucion ?? null;

		this.#solicitud = new SolicitudCrearPedido(this);

		// En caso de una reejecución, el CRC debe sobreescribirse según el tipo de reejecucion.
		if (this.metadatos.opcionesDeReejecucion) {
			if (this.metadatos.opcionesDeReejecucion.generaUnClon()) {
				this.#solicitud.generarCrcUnico();
			} else {
				this.#solicitud.forzarCrc(this.metadatos.opcionesDeReejecucion.crcForzado());
			}
		}



		// PASO 1: Verificar si hay errores de protocolo
		if (this.#solicitud.contieneErroresProtocolo()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitud.generarJSON('errores'));
		}

		// PASO 2: Verificar si el pedido es duplicado (Este caso no se aplica en el caso de que estemos reejecutando)
		if (!this.metadatos.opcionesDeReejecucion) {
			let nodoVigente = await this.#solicitud.esDuplicado()
			if (nodoVigente) {

				let codigoEstadoRespuesta = nodoVigente.codigoEstadoRespuestaCliente;
				let cuerpoRespuesta = nodoVigente.cuerpoRespuestaCliente;
				let errorDuplicado = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado', 400);

				if (codigoEstadoRespuesta && cuerpoRespuesta) {
					this.log.info('Se envía al cliente un duplicado de la respuesta del nodo vigente');
					let errorDuplicado = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado', 400);
					if (!Array.isArray(cuerpoRespuesta.incidencias)) cuerpoRespuesta.incidencias = [];
					cuerpoRespuesta.incidencias = cuerpoRespuesta.incidencias.concat(errorDuplicado.getErrores())
					return new ResultadoTransmision(codigoEstadoRespuesta, K.ESTADOS.DUPLICADO, cuerpoRespuesta);
				} else {
					this.log.warn('El nodo vigente no tiene respuesta, enviamos el mensaje de pedido duplicado');
					return errorDuplicado.generarResultadoTransmision(K.ESTADOS.DUPLICADO);
				}
			}
		}

		// PASO 3: Enviamos el pedido a SAP a ver que devuelve 
		try {
			this.log.info('Procedemos a enviar a SAP el pedido');
			this.sap.setTimeout(C.sap.timeout.crearPedido);
			await this.sap.post('/api/zsd_ent_ped_api/pedidos', this.#solicitud.generarJSON('sap'));
			this.log.info('Obtenida respuesta de SAP, procedemos a analizarla');
		} catch (errorLlamadaSap) {
			this.log.err('Incidencia en la comunicación con SAP, se simulan las faltas del pedido', errorLlamadaSap);
			//this.addError('PED-WARN-001', 'Su pedido se ha recibido correctamente, pero no hemos podido informar las faltas.');
			this.metadatos.noEnviaFaltas = true;
			return new ResultadoTransmision(201, K.ESTADOS.ERROR_RESPUESTA_SAP, this.#solicitud.generarJSON('errores'));
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
			return new ResultadoTransmision(409, K.ESTADOS.ERROR_RESPUESTA_SAP, this.#solicitud.generarJSON('noSap'));
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
			numeroPedidoOrigen: this.#solicitud.numeroPedidoOrigen,
			tipoPedido: parseInt(this.#solicitud.tipoPedido) || 0,
			crc: this.#solicitud.metadatos.crc,
			crcSap: M.toMongoLong(parseInt(this.#solicitud.metadatos.crc.toString().substring(0, 8), 16)),
			tipoCrc: this.#solicitud.metadatos.tipoCrc
		};

		if (this.metadatos.noEnviaFaltas) metadatos.noEnviaFaltas = true;

		if (this.#solicitud.metadatos.codigoAlmacenDesconocido) metadatos.codigoAlmacenDesconocido = true;
		if (this.#solicitud.metadatos.codigoAlmacenSaneado) metadatos.codigoAlmacenSaneado = true;
		if (this.#solicitud.metadatos.esRetransmisionCliente) metadatos.retransmisionCliente = true;
		if (this.#solicitud.metadatos.errorComprobacionDuplicado) metadatos.errorComprobacionDuplicado = true;
		if (this.#solicitud.metadatos.esDuplicado) metadatos.esDuplicado = true;


		if (this.#respuesta) {

			if (this.#respuesta.metadatos.erroresOcultados.tieneErrores()) metadatos.erroresOcultados = this.#respuesta.metadatos.erroresOcultados.getErrores();

			if (this.#respuesta.codigoAlmacenServicio) metadatos.codigoAlmacenServicio = this.#respuesta.codigoAlmacenServicio;
			if (this.#respuesta.metadatos.almacenesDeRebote.length) {
				metadatos.reboteFaltas = true;
				metadatos.almacenesDeRebote = this.#respuesta.metadatos.almacenesDeRebote;
			}
			if (this.#respuesta.metadatos.pedidoProcesadoSap) metadatos.pedidoProcesadoSap = true;
			if (this.#respuesta.metadatos.porRazonDesconocida) metadatos.porRazonDesconocida = true;
			if (this.#respuesta.metadatos.servicioDemorado) metadatos.servicioDemorado = true;
			if (this.#respuesta.metadatos.estupefaciente) metadatos.estupefaciente = true;
			if (this.#respuesta.metadatos.clienteBloqueadoSap) metadatos.clienteBloqueadoSap = true;
			if (this.#respuesta.metadatos.esPedidoDuplicadoSap) metadatos.esPedidoDuplicadoSap = true;


			if (this.#respuesta.metadatos.totales) metadatos.totales = this.#respuesta.metadatos.totales;
			if (this.#respuesta.metadatos.puntoEntrega) metadatos.puntoEntrega = this.#respuesta.metadatos.puntoEntrega;
			if (this.#respuesta.metadatos.tipoPedidoSap) metadatos.tipoPedidoSap = this.#respuesta.metadatos.tipoPedidoSap;
			if (this.#respuesta.metadatos.motivoPedidoSap) metadatos.motivoPedidoSap = this.#respuesta.metadatos.motivoPedidoSap;
			if (this.#respuesta.metadatos.clienteSap) metadatos.clienteSap = this.#respuesta.metadatos.clienteSap;

			if (this.#respuesta.metadatos.pedidosAsociadosSap?.length) metadatos.pedidosAsociadosSap = this.#respuesta.metadatos.pedidosAsociadosSap.map(nPed => M.toMongoLong(nPed));
			if (this.#respuesta.metadatos.pedidoAgrupadoSap) metadatos.pedidoAgrupadoSap = M.toMongoLong(this.#respuesta.metadatos.pedidoAgrupadoSap);

		}

		if (this.token.dominio === K.DOMINIOS.TRANSFER) {
			metadatos.esTransfer = true;
		}

		// Opciones de retransmision, si se está clonando otra transmisión
		if (this.metadatos.opcionesDeReejecucion) {
			metadatos.esReejecucion = true;
			metadatos.opcionesDeReejecucion = this.metadatos.opcionesDeReejecucion.generarMetadatos();
		}

		this.setMetadatosOperacion('pedido', metadatos);
	}

	// @Override
	generarMetadatosWebsocket() {

		if (this.#solicitud.contieneErroresProtocoloEnCabecera()) {
			this.setMetadatosWebsocket({
				contieneErroresProtocolo: true
			});
			return;
		}

		let metadatos = {
			codigoCliente: parseInt(this.#solicitud.codigoCliente.slice(-5)) || this.codigoCliente,
			//numeroPedidoOrigen: this.#solicitud.numeroPedidoOrigen,
			//tipoPedido: parseInt(this.#solicitud.tipoPedido) || 0,
			crc: this.#solicitud.metadatos.crc,
			//crcSap: M.toMongoLong(parseInt(this.#solicitud.metadatos.crc.toString().substring(0, 8), 16)),
			//tipoCrc: this.#solicitud.metadatos.tipoCrc
		};

		if (this.metadatos.noEnviaFaltas) metadatos.noEnviaFaltas = true;

		//if (this.#solicitud.metadatos.codigoAlmacenDesconocido) metadatos.codigoAlmacenDesconocido = true;
		//if (this.#solicitud.metadatos.codigoAlmacenSaneado) metadatos.codigoAlmacenSaneado = true;
		//if (this.#solicitud.metadatos.esRetransmisionCliente) metadatos.retransmisionCliente = true;
		//if (this.#solicitud.metadatos.errorComprobacionDuplicado) metadatos.errorComprobacionDuplicado = true;
		if (this.#solicitud.metadatos.esDuplicado) metadatos.esDuplicado = true;


		if (this.#respuesta) {

			//if (this.#respuesta.metadatos.erroresOcultados.tieneErrores()) metadatos.erroresOcultados = this.#respuesta.metadatos.erroresOcultados.getErrores();

			if (this.#respuesta.codigoAlmacenServicio) metadatos.codigoAlmacenServicio = this.#respuesta.codigoAlmacenServicio;
			/*
			if (this.#respuesta.metadatos.almacenesDeRebote.length) {
				metadatos.reboteFaltas = true;
				metadatos.almacenesDeRebote = this.#respuesta.metadatos.almacenesDeRebote;
			}
			*/
			//if (this.#respuesta.metadatos.pedidoProcesadoSap) metadatos.pedidoProcesadoSap = true;
			if (this.#respuesta.metadatos.porRazonDesconocida) metadatos.porRazonDesconocida = true;
			//if (this.#respuesta.metadatos.servicioDemorado) metadatos.servicioDemorado = true;
			//if (this.#respuesta.metadatos.estupefaciente) metadatos.estupefaciente = true;
			if (this.#respuesta.metadatos.clienteBloqueadoSap) metadatos.clienteBloqueadoSap = true;
			if (this.#respuesta.metadatos.esPedidoDuplicadoSap) metadatos.esPedidoDuplicadoSap = true;


			if (this.#respuesta.metadatos.totales?.lineas) metadatos.totales = this.#respuesta.metadatos.totales;
			//if (this.#respuesta.metadatos.puntoEntrega) metadatos.puntoEntrega = this.#respuesta.metadatos.puntoEntrega;
			//if (this.#respuesta.metadatos.tipoPedidoSap) metadatos.tipoPedidoSap = this.#respuesta.metadatos.tipoPedidoSap;
			//if (this.#respuesta.metadatos.motivoPedidoSap) metadatos.motivoPedidoSap = this.#respuesta.metadatos.motivoPedidoSap;
			//if (this.#respuesta.metadatos.clienteSap) metadatos.clienteSap = this.#respuesta.metadatos.clienteSap;

			if (this.#respuesta.metadatos.pedidosAsociadosSap?.length) metadatos.pedidosAsociadosSap = this.#respuesta.metadatos.pedidosAsociadosSap.map(nPed => M.toMongoLong(nPed));
			//if (this.#respuesta.metadatos.pedidoAgrupadoSap) metadatos.pedidoAgrupadoSap = M.toMongoLong(this.#respuesta.metadatos.pedidoAgrupadoSap);

		}

		if (this.token.dominio === K.DOMINIOS.TRANSFER) {
			metadatos.esTransfer = true;
		}

		// Opciones de retransmision, si se está clonando otra transmisión
		if (this.metadatos.opcionesDeReejecucion) {
			metadatos.esReejecucion = true;
			metadatos.opcionesDeReejecucion = this.metadatos.opcionesDeReejecucion.generarMetadatos();
		}

		this.setMetadatosWebsocket(metadatos);
	}
}


TransmisionCrearPedido.REGISTRAR_WEBSOCKET = true;
TransmisionCrearPedido.TIPO = K.TIPOS.CREAR_PEDIDO;
TransmisionCrearPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: true,
	simulacionesEnProduccion: false,
});


module.exports = TransmisionCrearPedido;