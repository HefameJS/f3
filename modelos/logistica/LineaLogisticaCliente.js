'use strict';
//const C = global.C;
//const K = global.K;


const ErrorFedicom = require('modelos/ErrorFedicom');
const Validador = require('global/validador');
const Modelo = require('modelos/transmision/Modelo');


class LineaLogisticaCliente extends Modelo {

	metadatos = {
		numeroPosicion: null,
		errores: new ErrorFedicom(),
		erroresProtocolo: false
	}

	orden;
	codigoArticulo;
	cantidad;
	descripcionArticulo;
	observaciones;

	constructor(transmision, json, numeroPosicion) {
		super(transmision);

		this.metadatos.numeroPosicion = numeroPosicion;
		this.log.info(`Posición ${numeroPosicion}: Analizando la línea de logística`);

		// Comprobamos los campos mínimos que deben aparecer en cada POSICION de un pedido de logistica
		let errorFedicom = new ErrorFedicom();
		// Estos campos son obligatorios:
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-LOG-ERR-000', 'El campo "codigoArticulo" es inválido');
		// Nota: la cantidad es obligatoria y debe ser > 0, pero en el caso de recibir una cantidad inválida, asignaremos un 1.

		if (errorFedicom.tieneErrores()) {
			this.log.warn(`Posición ${numeroPosicion}: La línea no cumple con la norma Fedicom3`, errorFedicom);
			this.metadatos.erroresProtocolo = true;
			this.metadatos.errores.insertar(errorFedicom);
		}


		// Copiamos las propiedades de la POSICION que son relevantes
		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.orden = parseInt(json.orden);
			} else {
				this.log.warn(`Posición ${numeroPosicion}: Se elimina el valor de "orden" por no ser válido: ${json.orden}`);
				// Si el orden no es válido o no aparece, el objeto padre que contiene esta línea le asignará un orden.
			}
		}

		// codigoArticulo
		this.codigoArticulo = json.codigoArticulo?.trim();

		// cantidad. Los valores no válidos se convierten en un 1.
		this.cantidad = parseInt(json.cantidad) || null;
		if (this.cantidad <= 0) {
			if (!this.cantidadBonificacion) {
				this.log.warn(`Posicion ${numeroPosicion}: Se establece el valor de "cantidad" a 1 por no ser válido: ${json.cantidad}`)
				this.cantidad = 1;
			} else {
				this.cantidad = 0;
			}
		}

		// descripcionArticulo
		if (Validador.esCadenaNoVacia(json.descripcionArticulo)) {
			this.descripcionArticulo = json.descripcionArticulo.trim();
		}


		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

	}


	esLineaCorrecta() {
		return !this.metadatos.erroresProtocolo;
	}

	/**
	 * - sap: Es para enviar la línea a SAP
	 * - respuestaCliente: Es para devolver la línea erronea al cliente
	 * @param {*} tipoDestino 
	 * @returns 
	 */
	generarJSON(tipoDestino = 'sap') {
		let json  = {};

		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.descripcionArticulo) json.descripcionArticulo = this.descripcionArticulo;
		if (this.cantidad >= 0) json.cantidad = this.cantidad;


		json.observaciones = this.observaciones;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.incidencias) json.incidencias = this.incidencias;

		if (tipoDestino === 'sap') {
			if (this.metadatos.lineaIncorrecta) json.sap_ignore = true;
		}
		return json;
	}

}


module.exports = LineaLogisticaCliente;
