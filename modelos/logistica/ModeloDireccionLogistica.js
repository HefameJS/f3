'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const Validador = require('global/validador');

class DireccionLogistica {
	constructor(txId, json) {

		this.metadatos = {
			errores: null // Null o un array de errores Fedicom si se detectan
		}

		// Comprobamos los campos mínimos que deben aparecer en una dirección
		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigo, errorFedicom, 'LOG-ERR-999', 'El campo "codigo" es obligatorio en la dirección');

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias y se lanza una excepción.
		if (errorFedicom.tieneErrores()) {
			this.metadatos.errores = errorFedicom.getErrores();
			return;
		}



		// Copiamos las propiedades de la dirección que son relevantes
		this.codigo = json.codigo.trim();

	}

	esErronea() {
		return this.metadatos.errores !== null;
	}

	getErrores() {
		return this.metadatos.errores;
	}

	generarJSON() {
		let respuesta = {}

		respuesta.codigo = this.codigo;

		return respuesta;
	}

}

module.exports = DireccionLogistica;

