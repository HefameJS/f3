'use strict';
const C = global.config;
const K = global.constants;
const M = global.mongodb;


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

	#solicitudCliente;
	#respuestaCliente;

	// @Override
	async operar() {

		this.#solicitudCliente = new SolicitudCrearLogistica(this);

		// PASO 1: Verificar si hay errores de protocolo
		if (this.#solicitudCliente.contieneErroresProtocolo()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitudCliente.generarJSON('errores'));
		}

		// PASO 2: Verificar si es una transmisión duplicada
		if (await this.#solicitudCliente.esDuplicado()) {
			return new ResultadoTransmision(400, K.ESTADOS.DUPLICADO, this.#solicitudCliente.generarJSON('errores'));
		}

		// PASO 3: Mandar a SAP y a ver si responde
		try {
			this.log.info('Procedemos a enviar a SAP la petición de logística');
			this.sap.setTimeout(C.sap.timeout.crearLogistica);
			await this.sap.post('/api/zsd_ent_ped_api/logistica', this.#solicitudCliente.generarJSON('sap'));
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

		this.#respuestaCliente = new RespuestaLogisticaSap(this);

		if (this.#respuestaCliente.esRespuestaDeErrores()) {
			return new ResultadoTransmision(409, K.ESTADOS.LOGISTICA.RECHAZADO_SAP, this.#respuestaCliente.generarJSON());
		}

		// En ocasiones, SAP devolvía un string que no era un JSON. Esto parece que ya no ocurre con el cambio a 'axios'
		// pero mantenemos la comprobación por si acaso
		if (this.#respuestaCliente.esRespuestaIncompresible()) {
			this.log.err('La respuesta de SAP es incomprensible, se envía error al cliente');
			let errorFedicom = new ErrorFedicom('LOG-ERR-999', 'No pudo registrarse la orden de logística, inténtelo de nuevo mas tarde.', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}

		let respuestaCliente = this.#respuestaCliente.generarJSON();
		let estadoTransmision = this.#respuestaCliente.determinarEstadoTransmision();
		return new ResultadoTransmision(201, estadoTransmision, respuestaCliente);

	}

	// @Override
	generarMetadatosOperacion() {

		if (this.#solicitudCliente.contieneErroresProtocolo()) {
			return;
		}

		let metadatos = {};
		/*
				metadatos.codigoCliente = parseInt(this.#datosEntrada.codigoCliente.slice(-5)) || null;
				metadatos.tipoLogistica = this.#datosEntrada.tipoLogistica;
				metadatos.crc = this.#metadatos.crc;
				
				if (this.#metadatos.retransmisionCliente) metadatos.retransmisionCliente = true;
				if (this.#metadatos.errorComprobacionDuplicado) metadatos.errorComprobacionDuplicado = true;
				if (this.#metadatos.clienteBloqueadoSap) metadatos.clienteBloqueadoSap = true;
		
				if (this.respuestaCliente;) {
		
					let d = this.respuestaCliente;;
					let md = this.respuestaCliente;.getMetadatos();
		
					if (md.puntoEntrega) metadatos.puntoEntrega = md.puntoEntrega;
					
					if (d.numeroLogistica) metadatos.numeroLogistica = toMongoLong(parseInt(numeroLogistica));
					if (d.codigoCliente) metadatos.codigoCliente = parseInt(d.codigoCliente.slice(-5));
		
					if (md.totales) metadatos.totales = md.totales;
		
				}
			*/
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