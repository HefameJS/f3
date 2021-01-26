'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');

// Helpers
const FieldChecker = require('util/fieldChecker');

class LineaLogistica {
	constructor(txId, json) {

		let errorFedicom = new ErrorFedicom();

		FieldChecker.checkPositive(json.orden, errorFedicom, 'LIN-LOG-ERR-001', 'El campo "orden" es inválido');
		FieldChecker.checkExistsAndNotEmptyString(json.codigoArticulo, errorFedicom, 'LIN-LOG-ERR-002', 'El campo "codigoArticulo" es obligatorio');
		// FieldChecker.checkExistsAndPositive(json.cantidad, errorPosicion, 'LIN-LOG-ERR-003', 'El campo "cantidad" es incorrecto');
		
		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// Si hay error, añadimos las incidencias a la linea y la marcamos para no procesar
		if (errorFedicom.hasError()) {
			this.sap_ignore = true;
			this.incidencias = errorFedicom.getErrors();
			L.xw(txId, ['Se ha descartado la línea de logística por errores en la misma.', this.incidencias]);
		}

	}

}


module.exports = LineaLogistica;
