'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');

// Helpers
const FieldChecker = require(BASE + 'util/fieldChecker');

class LineaLogistica {
	constructor(txId, json, index) {

		var errorPosicion = new ErrorFedicom();

		FieldChecker.checkPositive(json.orden, errorPosicion, 'LIN-LOG-ERR-001', 'El campo "orden" es inválido');
		FieldChecker.checkNotEmptyString(json.codigoArticulo, errorPosicion, 'LIN-LOG-ERR-002', 'El campo "codigoArticulo" es obligatorio');
		// FieldChecker.checkExistsAndPositive(json.cantidad, errorPosicion, 'LIN-LOG-ERR-003', 'El campo "cantidad" es incorrecto');
		
		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// Si hay error, añadimos las incidencias a la linea y la marcamos para no procesar
		if (errorPosicion.hasError()) {
			this.sap_ignore = true;
			this.incidencias = errorPosicion.getErrors();
			L.xw(txId, ['Se ha descartado la línea de logística por errores en la misma.', this.incidencias]);
		}

	}

}


module.exports = LineaLogistica;
