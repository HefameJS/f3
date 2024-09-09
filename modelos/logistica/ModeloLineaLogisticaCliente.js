'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const Validador = require('global/validador');


class LineaLogisticaCliente {
	constructor(json, txId, numeroPosicion) {

		L.xt(txId, ['Analizando linea de logistica en posición ' + numeroPosicion])

		this.metadatos = {
			lineaIncorrecta: false
		}

		// Comprobamos los campos mínimos que deben aparecer en cada POSICION de un pedido de logistica
		let errorFedicom = new ErrorFedicom();
		// Estos campos son obligatorios:
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-LOG-ERR-000', 'El campo "codigoArticulo" es inválido');

		// Nota: la cantidad debe ser > 0, pero en el caso de recibir una cantidad inválida, asignaremos un 1.


		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias de la linea.
		// - La posicion se marca como incorrecta, que hará que se incluya 'sap_ignore=true' para que SAP no la procese.
		if (errorFedicom.tieneErrores()) {
			L.xw(txId, ['Se han detectado errores graves en la línea - se marca para ignorar', numeroPosicion, errorFedicom]);
			this.metadatos.lineaIncorrecta = true;
			this.incidencias = errorFedicom.getErrores();
		}


		// Copiamos las propiedades de la POSICION que son relevantes

		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.orden = parseInt(json.orden);
			} else {
				L.xw(txId, ['El campo "orden" no es un entero >= 0', json.orden, numeroPosicion]);
				// Si el orden no es válido o no aparece, el objeto de Pedido que contiene esta línea le asignará un orden.
				// por eso no asignamos ningún valor por defecto
			}
		}

		// codigoArticulo
		this.codigoArticulo = json.codigoArticulo?.trim?.() ?? json.codigoArticulo;

		// cantidad. Los valores no válidos se convierten en un 1.
		this.cantidad = parseInt(json.cantidad) || null;
		if (this.cantidad <= 0) {
			if (!this.cantidadBonificacion) {
				L.xw(txId, ['Se establece el valor de cantidad a 1', json.cantidad, numeroPosicion]);
				this.cantidad = 1;
			} else {
				this.cantidad = 0;
			}
		}

		// descripcionArticulo
		if (Validador.esCadenaNoVacia(json.descripcionArticulo)) {
			this.descripcionArticulo = json.descripcionArticulo.trim();
		}

		// codigoBarrasExterno
		if (Validador.esCadenaNoVacia(json.codigoBarrasExterno)) {
			this.codigoBarrasExterno = json.codigoBarrasExterno.trim();
		}


		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

	}

	esLineaCorrecta() {
		return this.metadatos.lineaIncorrecta;
	}

	generarJSON(generarParaSap = true) {
		let json  = {};

		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.descripcionArticulo) json.descripcionArticulo = this.descripcionArticulo;
		if (this.cantidad >= 0) json.cantidad = this.cantidad;
		if (this.codigoBarrasExterno) json.codigoBarrasExterno = this.codigoBarrasExterno;

		json.observaciones = this.observaciones;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.incidencias) json.incidencias = this.incidencias;

		if (generarParaSap) {
			if (this.metadatos.lineaIncorrecta) json.sap_ignore = true;
		}
		return json;
	}

}


module.exports = LineaLogisticaCliente;
