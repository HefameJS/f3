'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');

// Helpers
const FieldChecker = require(BASE + 'util/fieldChecker');


class LineaPedido {
	constructor(json, txId, parent) {
		// SANEADO OBLIGATORIO


		var errorPosicion = new ErrorFedicom();

		// 001 - Control de codigo de artículo
		FieldChecker.checkNotEmptyString(json.codigoArticulo, errorPosicion, 'LIN-PED-ERR-001', 'El campo "codigoArticulo" es inválido');
		var errorCantidad = FieldChecker.checkExistsAndPositive(json.cantidad, errorPosicion, 'LIN-PED-ERR-002','El campo "cantidad" es inválido');
		FieldChecker.checkPositive(json.orden, errorPosicion, 'LIN-PED-ERR-003', 'El campo "orden" es inválido');


		// Añadimos las incidencias a la linea
		if (errorPosicion.hasError()) {
			this.sap_ignore = true;
			this.incidencias = errorPosicion.getErrors();

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
