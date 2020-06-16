'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');

// Helpers
const FieldChecker = require('util/fieldChecker');


class LineaPedido {
	constructor(txId, json) {
		// SANEADO OBLIGATORIO


		let errorFedicom = new ErrorFedicom();

		// 001 - Control de codigo de artículo
		FieldChecker.checkNotEmptyString(json.codigoArticulo, errorFedicom, 'LIN-PED-ERR-001', 'El campo "codigoArticulo" es inválido');
		let errorCantidad = FieldChecker.checkExistsAndPositive(json.cantidad, errorFedicom, 'LIN-PED-ERR-002','El campo "cantidad" es inválido');
		FieldChecker.checkPositive(json.orden, errorFedicom, 'LIN-PED-ERR-003', 'El campo "orden" es inválido');


		// Añadimos las incidencias a la linea
		if (errorFedicom.hasError()) {
			this.sap_ignore = true;
			this.incidencias = errorFedicom.getErrors();

			if (!errorCantidad) {
				json.cantidadFalta = json.cantidad;
			}
			if (!FieldChecker.checkExistsAndPositive(json.cantidadBonificacion, null)) {
				json.cantidadBonificacionFalta = json.cantidadBonificacion;
			}

			L.xw(txId, ['Se ha descartado la línea de pedido por errores en la petición.', this.incidencias]);
		}


		// COPIA DE PROPIEDADES
		Object.assign(this, json);


	}

}


module.exports = LineaPedido;
