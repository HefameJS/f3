'use strict';
//const C = global.C;
//const K = global.K;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

// Utiles
const Validador = require('global/validador');
const Modelo = require('modelos/transmision/Modelo');
const LineaConfirmacionAlbaran = require('./LineaConfirmacionAlbaran');

/**
 * Esta clase representa una confirmacion de las lineas de un albarán.
 * 
 * {
 * 	numeroAlbaran: "AB54545455",
 * 	fechaAlbaran": "02/12/2017,
 * 	lineas: [
 * 		{
 * 			codigoArticulo: "84021545454574",
 * 			lote: "16L4534",
 * 			fechaCaducidad: "01/05/2017"
 * 		}
 * }
 */
class SolicitudConfirmacionAlbaran extends Modelo {

	metadatos = {
		errores: new ErrorFedicom(),
		errorProtocolo: false,
		ignorarTodasLineas: true,
		totales: {
			lineas: 0,
			lineasIncidencias: 0
		}
	}

	numeroAlbaran;
	fechaAlbaran;
	lineas;

	constructor(transmision) {
		super(transmision);

		let json = this.transmision.req.body;

		this.log.info('Analizando datos de la confirmación de albarán entrante');
		// SANEADO OBLIGATORIO
		let errorFedicom = new ErrorFedicom();

		Validador.esCadenaNoVacia(json.numeroAlbaran, errorFedicom, 'CONF-ERR-001', 'El parámetro "numeroAlbaran" es inválido');
		Validador.esFecha(json.fechaAlbaran, errorFedicom, 'CONF-ERR-002', 'El parámetro "fechaAlbaran" es inválido');
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'CONF-ERR-004', 'El parámetro "lineas" es inválido');

		if (errorFedicom.tieneErrores()) {
			this.log.warn('La confirmación del albarán contiene errores de protocolo:', errorFedicom);
			this.metadatos.errores = errorFedicom;
			this.metadatos.errorProtocolo = true;
			return;
		}

		// Copiamos la información del mensaje
		this.numeroAlbaran = json.numeroAlbaran.trim();
		this.fechaAlbaran = json.fechaAlbaran.trim();

		this.#analizarPosiciones(json.lineas);
		if (this.metadatos.ignorarTodasLineas) {
			this.metadatos.errores.insertar('CONF-ERR-999', 'Todas las líneas son incorrectas');
		}

	}

	#analizarPosiciones(lineas) {

		this.lineas = [];

		lineas.forEach((linea, i) => {
			let nuevaLinea = new LineaConfirmacionAlbaran(this, linea, i);
			this.lineas.push(nuevaLinea);

			this.metadatos.totales.lineas++;
			if (nuevaLinea.metadatos.errorProtocolo) {
				this.metadatos.totales.lineasIncidencias++;
			} else {
				this.metadatos.ignorarTodasLineas = false;
			}
		})

	}

	tieneErrores() {
		return this.metadatos.errorProtocolo || this.metadatos.ignorarTodasLineas;
	}

	generarJSON(tipoDestino = 'sap') {

		if (this.metadatos.errores.errorProtocolo) {
			return this.metadatos.errores.getErrores();
		}

		let json = {
			numeroAlbaran: this.numeroAlbaran,
			fechaAlbaran: this.fechaAlbaran,
			lineas: this.lineas.map(linea => linea.generarJSON())
		}
		if (this.metadatos.errores.tieneErrores()) {
			json.incidencias = this.metadatos.errores.getErrores();
		}

		if (tipoDestino === 'sap') {
			json.login = this.token.generaDatosLoginSap();
		}

		return json;
	}
}








module.exports = SolicitudConfirmacionAlbaran;