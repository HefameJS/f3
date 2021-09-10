'use strict';
const C = global.C;
const K = global.K;
const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const IntercambioSap = require('modelos/transmision/IntercambioSap');
const ResultadoTransmisionPdf = require('modelos/transmision/ResultadoTransmisionPdf');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionConsultarDevolucion extends Transmision {

	metadatos = {							// Metadatos
		numeroDevolucion: null,				// (int64) el numero de devolución consultado
		formatoRespuesta: null,				// (string) El formato de la consulta (PDF o JSON)
		codigoCliente: null					// El código de cliente al que pertenece el albarán, si podemos sacarlo...
	}

	// @Override
	async operar() {

		let numeroDevolucionRecibida = this.req.params?.numeroDevolucion;
		this.metadatos.numeroDevolucion = parseInt(numeroDevolucionRecibida);

		if (!this.metadatos.numeroDevolucion) {
			this.log.warn('El numero de devolución indicado no es un entero válido');
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 400);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}


		switch (this.req.headers?.['accept']?.toLowerCase?.()) {
			case 'application/pdf': this.metadatos.formatoRespuesta = 'PDF'; break;
			default: this.metadatos.formatoRespuesta = 'JSON'; break;
		}


		this.log.info(`Se determina el formato solicitado de la devolución ${this.req.headers?.['accept']} -> ${this.metadatos.formatoRespuesta}`);

		switch (this.metadatos.formatoRespuesta) {
			case 'PDF':
				return this.#consultarFormatoPDF();
			default:
				return this.#consultarFormatoJSON();
		}

	}


	async #consultarFormatoJSON() {

		try {
			let consulta = {
				tipo: K.TIPOS.CREAR_DEVOLUCION,
				'devolucion.numeroDevolucion': M.toMongoLong(this.metadatos.numeroDevolucion)
			}

			let respuestaDevolucion = await M.col.transmisiones.findOne(consulta, {
				projection: {
					'_id': 1,
					'conexion.respuesta': 1,
					'devolucion.codigoCliente': 1
				}
			});

			// Vemos si ha devuelto el codigo del cliente
			this.metadatos.codigoCliente = respuestaDevolucion?.devolucion?.codigoCliente;

			if (respuestaDevolucion?.conexion?.respuesta?.body) {
				this.log.info(`Recuperada la respuesta de la devolución con txId ${respuestaDevolucion?._id}`);
				return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, respuestaDevolucion.conexion.respuesta.body);
			} else {
				this.log.warn(`No se ha encontrado la devolución`);
				let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 400);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
			}

		} catch (errorMongo) {
			this.log.err('Ocurrió un error al localizar la devolución en la base de datos', errorMongo);
			let errorFedicom = new ErrorFedicom('PED-ERR-999', 'Ocurrió un error al recuperar la devolución', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.ERROR);
		}

	}


	async #consultarFormatoPDF() {

		try {
			this.sap.setTimeout(C.sap.timeout.consultaDevolucionPDF);
			this.sap.setFuncionValidadora(IntercambioSap.validador.consultaDevolucionPDF);
			await this.sap.get('/api/zsf_get_document/devo_fedi/' + this.metadatos.numeroDevolucion);

			let cuerpoSap = this.sap.getRespuesta();

			if (cuerpoSap?.[0]?.pdf_file) {
				this.log.info('Se obtuvo la devolución PDF en Base64 desde SAP');
				if (cuerpoSap[0].kunnr) this.metadatos.codigoCliente = cuerpoSap[0].kunnr;
				let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');
				return new ResultadoTransmisionPdf(200, K.ESTADOS.COMPLETADO, buffer, this.metadatos.numeroDevolucion + '.pdf');
			} else {
				this.log.info('SAP no ha devuelto ningún documento. Esta es la manera "especial" de SAP de indicarnos esto:', cuerpoSap);
				let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
			}


		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error en la comunicación con SAP mientras se consultaba la devolución PDF', errorLlamadaSap);
			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'Ocurrió un error en la búsqueda de la devolución', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}


	}


	// @Override
	generarMetadatosOperacion() {
		if (this.metadatos.numeroDevolucion) {
			let metadatos = {
				numeroDevolucion: this.metadatos.numeroDevolucion,
				formatoRespuesta: this.metadatos.formatoRespuesta
			}
			if (this.metadatos.codigoCliente) {
				metadatos.codigoCliente = parseInt(this.metadatos.codigoCliente.slice(-5));
			}
			this.setMetadatosOperacion('devolucion.consultar', metadatos);
		}

	}
}



TransmisionConsultarDevolucion.TIPO = K.TIPOS.CONSULTAR_DEVOLUCION;
TransmisionConsultarDevolucion.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionConsultarDevolucion;