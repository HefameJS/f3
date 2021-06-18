'use strict';
const C = global.config;
const K = global.constants;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

let toMongoLong = require("mongodb").Long.fromNumber;
const SolicitudCrearLogistica = require('modelos/logistica/SolicitudCrearLogistica');
const RespuestaLogisticaSap = require('modelos/logistica/RespuestaLogisticaSap');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionCrearLogistica extends Transmision {

	#solicitud;
	#respuesta;

	// @Override
	async operar() {

		this.#solicitud = new SolicitudCrearLogistica(this);

		// PASO 1: Verificar si hay errores de protocolo
		if (this.#solicitud.contieneErroresProtocolo()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitud.generarJSON('errores'));
		}

		// PASO 2: Verificar si es una transmisión duplicada
		if (await this.#solicitud.esDuplicado()) {
			return new ResultadoTransmision(400, K.ESTADOS.DUPLICADO, this.#solicitud.generarJSON('errores'));
		}

		// PASO 3: Mandar a SAP y a ver si responde
		try {
			this.log.info('Procedemos a enviar a SAP la petición de logística');
			this.sap.setTimeout(C.sap.timeout.crearLogistica);
			await this.sap.post('/api/zsd_ent_ped_api/logistica', this.#solicitud.generarJSON('sap'));
			this.log.info('Obtenida respuesta de SAP, procedemos a analizarla');
		} catch (errorLlamadaSap) {
			this.log.err('No se pudo contactar con SAP, se envía error al cliente');
			let errorFedicom = new ErrorFedicom('LOG-ERR-999', 'No pudo registrarse la orden de logística, inténtelo de nuevo mas tarde.', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}

		// PASO 4: A ver que nos ha mandado SAP...
		return await this.#procesarResultadoSap();

	}


	async #procesarResultadoSap() {

		this.#respuesta = new RespuestaLogisticaSap(this);

		if (this.#respuesta.metadatos.esRespuestaDeErrores) {
			return new ResultadoTransmision(409, K.ESTADOS.LOGISTICA.RECHAZADO_SAP, this.#respuesta.generarJSON());
		}

		// En ocasiones, SAP devolvía un string que no era un JSON. Esto parece que ya no ocurre con el cambio a 'axios'
		// pero mantenemos la comprobación por si acaso
		if (this.#respuesta.metadatos.esRespuestaIncompresible) {
			this.log.err('La respuesta de SAP es incomprensible, se envía error al cliente');
			let errorFedicom = new ErrorFedicom('LOG-ERR-999', 'No pudo registrarse la orden de logística, inténtelo de nuevo mas tarde.', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
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

		let metadatos = {};
		// Metadatos de la SOLICITUD
		metadatos.codigoCliente = parseInt(this.#solicitud.codigoCliente.slice(-5)) || this.#solicitud.codigoCliente;
		metadatos.tipoLogistica = this.#solicitud.tipoLogistica;
		metadatos.crc = this.#solicitud.metadatos.crc;
		if (this.#solicitud.metadatos.esRetransmisionCliente) metadatos.retransmisionCliente = this.#solicitud.metadatos.esRetransmisionCliente;
		if (this.#solicitud.metadatos.errorComprobacionDuplicado) metadatos.errorComprobacionDuplicado = this.#solicitud.metadatos.errorComprobacionDuplicado;

		// Metadatos de la RESPUESTA

		if (this.#respuesta) {
			if (this.#respuesta.numeroLogistica) metadatos.numeroLogistica = toMongoLong(parseInt(this.#respuesta.numeroLogistica));
			if (this.#respuesta.metadatos.puntoEntrega) metadatos.puntoEntrega = this.#respuesta.metadatos.puntoEntrega;
			if (this.#respuesta.metadatos.erroresOcultados.tieneErrores()) metadatos.erroresOcultados = this.#respuesta.metadatos.erroresOcultados.getErrores();
			if (this.#respuesta.metadatos.clienteBloqueadoSap) metadatos.clienteBloqueadoSap = this.#respuesta.metadatos.clienteBloqueadoSap;
			if (this.#respuesta.metadatos.totales) metadatos.totales = this.#respuesta.metadatos.totales;
		}

		this.setMetadatosOperacion('logistica', metadatos);

	}

}



TransmisionCrearLogistica.TIPO = K.TIPOS.CREAR_LOGISTICA;
TransmisionCrearLogistica.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: false,
});


module.exports = TransmisionCrearLogistica;