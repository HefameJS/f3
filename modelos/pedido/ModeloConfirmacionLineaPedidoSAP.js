'use strict';
const L = global.logger;

const ErrorFedicom = require('modelos/ErrorFedicom');
const FieldChecker = require('util/fieldChecker');

class ConfirmacionLineaPedidoSAP {
	constructor(txId, json) {

		let errorFedicom = new ErrorFedicom();

		// 001 - Control de codigo de artículo
		if (json.sap_ignore) {
			errorFedicom.insertar('SAP-WARN-LIN-001', 'Línea ignorada por errores de sintáxis', 400);
		} else {
			FieldChecker.checkExistsAndPositiveOrZero(json.orden, errorFedicom, 'SAP-ERR-LIN-001', 'El campo "orden" es inválido');
			FieldChecker.checkExistsAndPositive(json.posicion_sap, errorFedicom, 'SAP-ERR-LIN-002', 'El campo "posicion_sap" es inválido');
			FieldChecker.checkExists(json.codigoarticulo, errorFedicom, 'SAP-ERR-LIN-003', 'El campo "codigoarticulo" es inválido');
			FieldChecker.checkExistsAndPositive(json.cantidad, errorFedicom, 'SAP-ERR-LIN-004', 'El campo "cantidad" es inválido');
			FieldChecker.checkExistsAndPositiveOrZero(json.cantidadfalta , errorFedicom, 'SAP-ERR-LIN-005', 'El campo "cantidadfalta" es inválido');
			FieldChecker.checkExistsAndPositiveOrZero(json.cantidadbonificacion , errorFedicom, 'SAP-ERR-LIN-006', 'El campo "cantidadbonificacion" es inválido');
			FieldChecker.checkExistsAndPositiveOrZero(json.cantidadbonificacionfalta, errorFedicom, 'SAP-ERR-LIN-007', 'El campo "cantidadbonificacionfalta" es inválido');
			FieldChecker.checkExists(json.codigoalmacenservicio, errorFedicom, 'SAP-ERR-LIN-008', 'El campo "codigoalmacenservicio" es inválido');
		}
		// Añadimos las incidencias a la linea
		if (errorFedicom.tieneErrores()) {
			this.sap_ignore = true;
			L.xw(txId, ['Se ignora la linea.', errorFedicom.getErrores()]);
		}

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

	}
}


module.exports = ConfirmacionLineaPedidoSAP;
