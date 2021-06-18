'use strict';
const C = global.config;
const K = global.constants;
const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

let toMongoLong = require("mongodb").Long.fromNumber;
const IntercambioSap = require('modelos/transmision/IntercambioSap');
const ResultadoTransmisionPdf = require('modelos/transmision/ResultadoTransmisionPdf');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionConsultarAlbaran extends Transmision {

	#metadatos = {							// Metadatos
		numeroAlbaran: null,				// (int64) el numero de albarán consultado
		formatoRespuesta: null,
	}

	// @Override
	async operar() {

		let numeroAlbaranRecibido = this.req.params?.numeroAlbaran;
		this.#metadatos.numeroAlbaran = parseInt(numeroAlbaranRecibido);

		if (!this.#metadatos.numeroAlbaran) {
			this.log.warn(`El numero de albarán indicado "${numeroAlbaranRecibido}" no es un entero válido`);
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 400);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}


		switch (this.req.headers?.['accept']?.toLowerCase?.()) {
			case 'application/pdf': this.#metadatos.formatoRespuesta = 'PDF'; break;
			default: this.#metadatos.formatoRespuesta = 'JSON'; break;
		}


		this.log.info(`Se determina el formato solicitado del albarán ${this.req.headers?.['accept']} -> ${this.#metadatos.formatoRespuesta}`);

		switch (this.#metadatos.formatoRespuesta) {
			case 'PDF':
				return this.#consultarFormatoPDF();
			default:
				return this.#consultarFormatoJSON();
		}

	}


	async #consultarFormatoJSON() {
		try {
			this.sap.setTimeout(C.sap.timeout.consultaDevolucionPDF);
			this.sap.setFuncionValidadora(IntercambioSap.validador.consultaAlbaranJSON);
			await this.sap.get('/api/zsd_orderlist_api/view/' + this.#metadatos.numeroAlbaran);

			let cuerpoSap = this.sap.getRespuesta();

			if (cuerpoSap?.t_pos) {
				let datosAlbaran = new Albaran(cuerpoSap);
				return new ResultadoTransmisionPdf(200, K.ESTADOS.COMPLETADO, datosAlbaran);
			} else {
				this.log.info('SAP no ha devuelto ningún documento. Esta es la manera "especial" de SAP de indicarnos esto:', cuerpoSap);
				let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'El albarán solicitado no existe', 404);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
			}



		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error en la comunicación con SAP mientras se consultaba la devolución PDF', errorLlamadaSap);
			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'Ocurrió un error en la búsqueda de la devolución', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}
		
	}


	async #consultarFormatoPDF() {

		try {
			this.sap.setTimeout(C.sap.timeout.consultaDevolucionPDF);
			await this.sap.get('/api/zsf_get_document/proforma/' + this.#metadatos.numeroAlbaran);

			let cuerpoSap = this.sap.getRespuesta();

			if (cuerpoSap?.[0]?.pdf_file) {
				this.log.info('Se obtuvo el albarán PDF en Base64 desde SAP');
				let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');

				return new ResultadoTransmisionPdf(200, K.ESTADOS.COMPLETADO, buffer, this.#metadatos.numeroAlbaran + '.pdf');
			} else {
				this.log.info('SAP no ha devuelto ningún documento. Esta es la manera "especial" de SAP de indicarnos esto:', cuerpoSap);
				let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'No se encontró el albarán', 404);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
			}


		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán PDF', errorLlamadaSap);
			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'Ocurrió un error en la búsqueda del albarán', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}


	}


	// @Override
	generarMetadatosOperacion() {
		if (this.#metadatos.numeroAlbaran) {
			let metadatos = {
				numeroDevolucion: this.#metadatos.numeroAlbaran,
				formatoRespuesta: this.#metadatos.formatoRespuesta
			}
			this.setMetadatosOperacion('consulta.albaran', metadatos);
		}

	}
}



TransmisionConsultarAlbaran.TIPO = K.TIPOS.CONSULTAR_ALBARAN;
TransmisionConsultarAlbaran.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionConsultarAlbaran;