'use strict';
const BASE = global.BASE;
const L = global.logger;

const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');
const FieldChecker = require(BASE + 'util/fieldChecker');

class ConfirmacionLineaPedidoSAP {
	constructor(json, txId) {

		var errorPosicion = new ErrorFedicom();

		// 001 - Control de codigo de artículo
		if (json.sap_ignore) {
			errorPosicion.add('SAP-WARN-LIN-001', 'Línea ignorada por errores de sintáxis', 400);
		} else {
			FieldChecker.checkExistsAndPositiveOrZero(json.orden, errorPosicion, 'SAP-ERR-LIN-001', 'El campo "orden" es inválido');
			FieldChecker.checkExistsAndPositive(json.posicion_sap, errorPosicion, 'SAP-ERR-LIN-002', 'El campo "posicion_sap" es inválido');
			FieldChecker.checkExists(json.codigoarticulo, errorPosicion, 'SAP-ERR-LIN-003', 'El campo "codigoarticulo" es inválido');
			FieldChecker.checkExistsAndPositive(json.cantidad, errorPosicion, 'SAP-ERR-LIN-004', 'El campo "cantidad" es inválido');
			FieldChecker.checkExistsAndPositiveOrZero(json.cantidadfalta , errorPosicion, 'SAP-ERR-LIN-005', 'El campo "cantidadfalta" es inválido');
			FieldChecker.checkExistsAndPositiveOrZero(json.cantidadbonificacion , errorPosicion, 'SAP-ERR-LIN-006', 'El campo "cantidadbonificacion" es inválido');
			FieldChecker.checkExistsAndPositiveOrZero(json.cantidadbonificacionfalta, errorPosicion, 'SAP-ERR-LIN-007', 'El campo "cantidadbonificacionfalta" es inválido');
			FieldChecker.checkExists(json.codigoalmacenservicio, errorPosicion, 'SAP-ERR-LIN-008', 'El campo "codigoalmacenservicio" es inválido');
		}
		// Añadimos las incidencias a la linea
		if (errorPosicion.hasError()) {
			this.sap_ignore = true;
			L.xw(txId, ['Se ignora la linea.', errorPosicion.getErrors()]);
		}

		// COPIA DE PROPIEDADES
		Object.assign(this, json);


	}


}


module.exports = ConfirmacionLineaPedidoSAP;
