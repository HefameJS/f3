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

		// Copiamos las propiedades de la dirección que son relevantes
		this.codigo = json.codigo.trim();

		let tmp;

		tmp = json.codigo;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.codigo = tmp.trim();
		}


		tmp = json.cif || json.CIF;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.cif = tmp.trim();
		}

		tmp = json.soe || json.SOE;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.soe = tmp.trim();
		}

		tmp = json.nombre;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.nombre = tmp.trim();
		}

		tmp = json.calle;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.calle = tmp.trim();
		}

		tmp = json.poblacion;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.poblacion = tmp.trim();
		}

		tmp = json.provincia;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.provincia = tmp.trim();
		}

		tmp = json.codigoPostal || json.codigopostal;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.codigoPostal = tmp.trim();
		}

		tmp = json.pais;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.pais = tmp.trim();
		}

		tmp = json.telefono;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.telefono = tmp.trim();
		}

		tmp = json.email;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.email = tmp.trim();
		}

		tmp = json.codigoAlmacen || json.werks;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.codigoAlmacen = tmp.trim();
		}

		tmp = json.descripcionAlmacen || json.werks_name;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.descripcionAlmacen = tmp.trim();
		}

		tmp = json.ruta;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.ruta = tmp.trim();
		}

		tmp = json.descripcionRuta || json.ruta_desc;
		if (Validador.esCadenaNoVacia(tmp)) {
			this.descripcionRuta = tmp.trim();
		}

	}

	esErronea() {
		return this.metadatos.errores !== null;
	}

	getErrores() {
		return this.metadatos.errores;
	}

	generarJSON(generarParaSap = true) {
		let respuesta = {}

		if (this.codigo) respuesta.codigo = this.codigo;
		if (this.cif) respuesta.cif = this.cif;
		if (this.soe) respuesta.soe = this.soe;
		if (this.nombre) respuesta.nombre = this.nombre;
		if (this.calle) respuesta.calle = this.calle;
		if (this.poblacion) respuesta.poblacion = this.poblacion;
		if (this.provincia) respuesta.provincia = this.provincia;
		if (this.codigoPostal) respuesta.codigoPostal = this.codigoPostal;
		if (this.pais) respuesta.pais = this.pais;
		if (this.telefono) respuesta.telefono = this.telefono;
		if (this.email) respuesta.email = this.email;
		if (this.codigoAlmacen) respuesta.codigoAlmacen = this.codigoAlmacen;
		if (this.descripcionAlmacen) respuesta.descripcionAlmacen = this.descripcionAlmacen;
		if (this.ruta) respuesta.ruta = this.ruta;
		if (this.descripcionRuta) respuesta.descripcionRuta = this.descripcionRuta;

		return respuesta;
	}

}

module.exports = DireccionLogistica;

