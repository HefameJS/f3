'use strict';
const C = global.C;
const K = global.K;
//const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const ConsultaStock = require('modelos/stock/ConsultaStock');
const RespuestaStock = require('modelos/stock/RespuestaStock');


/**
 * Clase que representa una transmisión de una consulta de stock.
 */
class TransmisionConsultarStock extends Transmision {

	metadatos = {
		consulta: null,
		numeroResultados: 0
	}

	// @Override
	async operar() {

		// Analisis de la consulta del cliente
		this.metadatos.consulta = new ConsultaStock(this);

		if (this.metadatos.consulta.tieneErrores()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.metadatos.consulta.getErrores());
		}

		try {
			this.log.debug('Realizando consulta de albaranes a SAP')
			this.sap.setTimeout(C.sap.timeout.listadoAlbaranes) // TODO: Definir consulta STOCK
			await this.sap.get('/api/zsd_tc_constock/' + this.metadatos.consulta.generarParametrosLlamadaSap());
		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error al hacer la llamada de consulta de stock en SAP', errorLlamadaSap);
			let errorFedicom = new ErrorFedicom('STOCK-ERR-999', 'Ocurrió un error en la consulta de stock', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}


		let cuerpoSap = this.sap.getRespuesta();
		if (Array.isArray(cuerpoSap) && cuerpoSap.length) {
			this.log.info(`SAP ha devuelto ${cuerpoSap.length} artículos`);
			this.metadatos.numeroResultados = cuerpoSap.length;

			let stockJson = cuerpoSap.map(stockSap => new RespuestaStock(stockSap));
			return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, stockJson);
		} else {
			this.log.warn("SAP no ha devuelto artículos:", cuerpoSap);
			let errorFedicom = new ErrorFedicom('STOCK-ERR-001', 'No se encuentran artículos', 404);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.CONSULTA.NO_EXISTE);
		}


	}


	// @Override
	generarMetadatosOperacion() {

		let metadatos = {
			numeroResultados: this.metadatos.numeroResultados
		}

		if (this.req.query) {
			metadatos.consultaCliente = {};
			if (this.req.query.codigoCliente) {
				metadatos.consultaCliente.codigoCliente = this.req.query.codigoCliente;
				metadatos.codigoCliente = parseInt(this.req.query.codigoCliente.slice(-5));
			}
			if (this.req.query.tipoConsulta) metadatos.consultaCliente.tipoConsulta = this.req.query.tipoConsulta;
		}

		this.setMetadatosOperacion('albaran.buscar', metadatos);
	}
}



TransmisionConsultarStock.TIPO = K.TIPOS.CONSULTAR_STOCK;
TransmisionConsultarStock.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionConsultarStock;