'use strict';
const C = global.C;
const K = global.K;
const M = global.M;
const Transmision = require('modelos/transmision/Transmision');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const RespuestaDevolucionSap = require('modelos/devolucion/RespuestaDevolucionSap');

const SolicitudCrearDevolucion = require('modelos/devolucion/SolicitudCrearDevolucion');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionCrearDevolucion extends Transmision {

	#solicitud;
	#respuesta;

	// @Override
	async operar() {

		this.#solicitud = new SolicitudCrearDevolucion(this)
		
		if (this.#solicitud.contieneErroresProtocolo()) {
			this.log.warn('La petición contiene errores de protocolo, se responde sin llamar a SAP');
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitud.generarJSON('errores'));
		}

		try {
			this.log.info('Procedemos a enviar a SAP la devolución');
			this.sap.setTimeout(C.sap.timeout.crearDevolucion);
			await this.sap.post('/api/zsd_ent_ped_api/devoluciones', this.#solicitud.generarJSON('sap'));
			this.log.info('Obtenida respuesta de SAP, procedemos a analizarla');
		} catch (errorLlamadaSap) {
			this.log.err('Incidencia en la comunicación con SAP, no se graba la devolución', errorLlamadaSap);
			this.addError('DEV-ERR-999', 'No hemos podido grabar la devolución, reinténtelo mas tarde.');
			return new ResultadoTransmision(500, K.ESTADOS.ERROR_RESPUESTA_SAP, this.#solicitud.generarJSON('errores'));
		}

		this.#respuesta = new RespuestaDevolucionSap(this);

		if (this.#respuesta.metadatos.respuestaIncomprensible) {
			return new ResultadoTransmision(500, K.ESTADOS.ERROR_RESPUESTA_SAP, this.#respuesta.generarJSON('errores'));
		}

		this.#respuesta.insertarLineasRechazadas(this.#solicitud.getLineasErroneas());
		if (this.#respuesta.metadatos.clienteNoExiste || this.#respuesta.metadatos.todasLineasRechazadas) {
			return new ResultadoTransmision(400, K.ESTADOS.DEVOLUCION.RECHAZADA, this.#respuesta.generarJSON('errores'));
		}


		let codigoRespuestaHttp = 201;
		let estadoTransmision = K.ESTADOS.COMPLETADO;

		if (this.#respuesta.metadatos.lineasRechazadas.length) {
			codigoRespuestaHttp = 206;
			estadoTransmision = K.ESTADOS.DEVOLUCION.PARCIAL;
		}

		return new ResultadoTransmision(codigoRespuestaHttp, estadoTransmision, this.#respuesta.generarJSON('respuestaCliente'));


	}


	// @Override
	generarMetadatosOperacion() {
		if (this.#solicitud.contieneErroresProtocolo()) {
			return;
		}


		let metadatos = {
			codigoCliente: parseInt(this.#solicitud.codigoCliente.slice(-5)),
		}

		if (this.#solicitud.metadatos.contieneLineasErroneas) metadatos.contieneLineasErroneas = true;
		if (this.#solicitud.metadatos.errorProtocoloTodasLineas) metadatos.todasLineasErroneas = true;

		if (this.#respuesta) {
			let r = this.#respuesta;
			let m = r.metadatos;
			if (m.clienteNoExiste) metadatos.clienteNoExiste = true;
			if (m.devolucionDuplicadaSap) metadatos.devolucionDuplicadaSap = true;
			if (m.incidenciasCabeceraSap) metadatos.incidenciasCabeceraSap = true;
			if (m.creaOrdenLogistica) metadatos.creaOrdenLogistica = true;
			if (m.lineasRechazadas.length) metadatos.contieneLineasRechazadas = true;
			if (m.puntoEntrega) metadatos.puntoEntrega = m.puntoEntrega;
			if (m.numerosDevolucionSap) metadatos.numerosDevolucionSap = m.numerosDevolucionSap;
			if (m.totales) metadatos.totales = m.totales;

			if (r.numeroDevolucion) metadatos.numeroDevolucion = M.toMongoLong(parseInt(r.numeroDevolucion))
			if (r.codigoRecogida) metadatos.numeroLogistica = M.toMongoLong(parseInt(r.codigoRecogida))
		}

		this.setMetadatosOperacion('devolucion', metadatos);
	}

}


TransmisionCrearDevolucion.TIPO = K.TIPOS.CREAR_DEVOLUCION;
TransmisionCrearDevolucion.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: true,
	simulacionesEnProduccion: false
});


module.exports = TransmisionCrearDevolucion;