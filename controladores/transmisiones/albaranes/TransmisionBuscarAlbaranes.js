'use strict';
const C = global.C;
const K = global.K;
//const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Albaran = require('../../../modelos/albaran/Albaran');
const ConsultaAlbaran = require('../../../modelos/albaran/SolicitudConsultaAlbaran');


/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionBuscarAlbaranes extends Transmision {

	metadatos = {
		consulta: null,
		consultaSap: null,
		sabemosQueNoDaResultado: false,
		numeroResultados: 0
	}

	// @Override
	async operar() {

		// Analisis de la consulta del cliente
		this.metadatos.consulta = new ConsultaAlbaran(this);
		if (this.metadatos.consulta.tieneErrores()) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.metadatos.consulta.getErrores());
		}

		// Conversión de la consulta del cliente a la consulta a SAP
		this.metadatos.consultaSap = await this.metadatos.consulta.generarConsultaSap();
		if (this.metadatos.consultaSap.noVaADarResultados()) {
			this.log.info('Sabemos que la consulta no va a dar resultados. Respondemos un resultado vacío.');
			this.res.setHeader('X-Total-Count', 0);
			return new ResultadoTransmision(200, K.ESTADOS.CONSULTA.NO_EXISTE, []);
		}

		
		try {
			this.log.debug('Realizando consulta de albaranes a SAP')
			this.sap.setTimeout(C.sap.timeout.listadoAlbaranes)
			await this.sap.get('/api/zsd_orderlist_api/query_tree/?query=' + this.metadatos.consultaSap.generarQueryString());
		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error al hacer la llamada de consulta de albaranes en SAP', errorLlamadaSap);
			let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'Ocurrió un error en la búsqueda de albaranes', 500);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}


		let cuerpoSap = this.sap.getRespuesta();
		if (cuerpoSap?.tot_rec >= 0 && Array.isArray(cuerpoSap.t_data)) {
			this.log.info(`SAP ha devuelto ${cuerpoSap.t_data.length} de ${cuerpoSap.tot_rec} albaranes `);
			this.metadatos.numeroResultados = cuerpoSap.tot_rec;
			let albaranesJson = cuerpoSap.t_data.map(albaranSap => new Albaran(albaranSap));
			this.res.setHeader('X-Total-Count', this.metadatos.numeroResultados);
			return new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, albaranesJson);
		} else {
			this.log.warn("SAP no ha devuelto albaranes:", cuerpoSap);
			this.res.setHeader('X-Total-Count', 0);
			return new ResultadoTransmision(200, K.ESTADOS.CONSULTA.NO_EXISTE, []);
		}


	}


	// @Override
	generarMetadatosOperacion() {

		let metadatos = {
			numeroResultados: this.metadatos.numeroResultados
		}

		if (this.req.query) {
			metadatos.query = {};
			if (this.req.query.codigoCliente) {
				metadatos.query.codigoCliente = this.req.query.codigoCliente;
				metadatos.codigoCliente = parseInt(this.req.query.codigoCliente.slice(-5));
			}
			if (this.req.query.fechaDesde) metadatos.query.fechaDesde = this.req.query.fechaDesde;
			if (this.req.query.fechaHasta) metadatos.query.fechaHasta = this.req.query.fechaHasta;
			if (this.req.query.numeroAlbaran) metadatos.query.numeroAlbaran = this.req.query.numeroAlbaran;
			if (this.req.query.fechaAlbaran) metadatos.query.fechaAlbaran = this.req.query.fechaAlbaran;
			if (this.req.query.numeroPedido) metadatos.query.numeroPedido = this.req.query.numeroPedido;
			if (this.req.query.numeroPedidoOrigen) metadatos.query.numeroPedidoOrigen = this.req.query.numeroPedidoOrigen;
		}

		if (this.metadatos.sabemosQueNoDaResultado) metadatos.sabemosQueNoDaResultado = true;
		if (this.metadatos.consultaSap) metadatos.consultaSap = this.metadatos.consultaSap.generarJSON();

		this.setMetadatosOperacion('albaran.buscar', metadatos);
	}
}



TransmisionBuscarAlbaranes.TIPO = K.TIPOS.BUSCAR_ALBARANES;
TransmisionBuscarAlbaranes.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: true,
});


module.exports = TransmisionBuscarAlbaranes;