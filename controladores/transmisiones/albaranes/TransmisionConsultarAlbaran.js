'use strict';
const C = global.C;
const K = global.K;
const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Albaran = require('modelos/albaran/Albaran');


const IntercambioSap = require('modelos/transmision/IntercambioSap');
const ResultadoTransmisionPdf = require('modelos/transmision/ResultadoTransmisionPdf');


/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionConsultarAlbaran extends Transmision {

	metadatos = {							// Metadatos
		numeroAlbaran: null,				// (string) El número de albarán consultado
		formatoRespuesta: null,				// (string) El formato de la consulta (PDF o JSON)
		codigoCliente: null					// El código de cliente al que pertenece el albarán, si podemos sacarlo...
	}

	// @Override
	async operar() {

		let numeroAlbaranRecibido = this.req.params?.numeroAlbaran;
		this.metadatos.numeroAlbaran = parseInt(numeroAlbaranRecibido);

		if (!this.metadatos.numeroAlbaran) {
			this.log.warn(`El numero de albarán indicado "${numeroAlbaranRecibido}" no es un entero válido`);
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 400);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}

		this.log.info(`Se solicita el número de albarán ${this.metadatos.numeroAlbaran}`)

		switch (this.req.headers?.['accept']?.toLowerCase?.()) {
			case 'application/pdf': this.metadatos.formatoRespuesta = 'PDF'; break;
			default: this.metadatos.formatoRespuesta = 'JSON'; break;
		}


		this.log.info(`Se determina el formato solicitado del albarán ${this.req.headers?.['accept']} -> ${this.metadatos.formatoRespuesta}`);

		switch (this.metadatos.formatoRespuesta) {
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
			await this.sap.get('/api/zsd_orderlist_api/view/' + this.metadatos.numeroAlbaran.toString().padStart(10, '0'));

			let cuerpoSap = this.sap.getRespuesta();

			if (cuerpoSap?.t_pos) {
				let datosAlbaran = new Albaran(cuerpoSap);
				if (datosAlbaran.codigoCliente) this.metadatos.codigoCliente = datosAlbaran.codigoCliente;
				// 02/06/2023 - Se fuerza que el numero de albarán en la respuesta sea exactamente
				// el mismo que se pide en la petición.
				datosAlbaran.numeroAlbaran = this.metadatos.numeroAlbaran;
				return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, datosAlbaran);
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
			await this.sap.get('/api/zsf_get_document/proforma/' + this.metadatos.numeroAlbaran.toString().padStart(10, '0'));

			let cuerpoSap = this.sap.getRespuesta();

			if (cuerpoSap?.[0]?.pdf_file) {
				this.log.info('Se obtuvo el albarán PDF en Base64 desde SAP');
				if (cuerpoSap[0].kunnr) this.metadatos.codigoCliente = cuerpoSap[0].kunnr;
				let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');
				return new ResultadoTransmisionPdf(200, K.ESTADOS.COMPLETADO, buffer, this.metadatos.numeroAlbaran + '.pdf');
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
		if (this.metadatos.numeroAlbaran) {
			let metadatos = {
				numeroAlbaran: M.toMongoLong(this.metadatos.numeroAlbaran),
				formatoRespuesta: this.metadatos.formatoRespuesta
			}
			if (this.metadatos.codigoCliente) {
				metadatos.codigoCliente = parseInt(this.metadatos.codigoCliente.slice(-5));
			}
			this.setMetadatosOperacion('albaran.consultar', metadatos);
		}

	}
}



TransmisionConsultarAlbaran.TIPO = K.TIPOS.CONSULTAR_ALBARAN;
TransmisionConsultarAlbaran.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionConsultarAlbaran;