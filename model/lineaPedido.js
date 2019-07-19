'use strict';
const BASE = global.BASE;
const L = global.logger;

const FedicomError = require(BASE + 'model/fedicomError');



class LineaPedido {
	constructor(json, txId, parent) {
		// SANEADO OBLIGATORIO


		var errorPosicion = new FedicomError();

		// if (json.orden === undefined) fedicomError.add('LIN-PED-ERR-001', 'El campo "orden" es obligatorio. Se descarta la línea.', 400);

		// 001 - Control de codigo de artículo
		if (!json.codigoArticulo) {
			errorPosicion.add('LIN-PED-ERR-001', 'El campo "codigoArticulo" es inválido', 400);
		}

		// 002 - Control de la cantidad
		if (!json.cantidad) {
			errorPosicion.add('LIN-PED-ERR-002', 'El campo "cantidad" es inválido', 400);
		} else {
			json.cantidad = Number(json.cantidad);
			if (!json.cantidad || json.cantidad <= 0 || json.cantidad === Number.NaN || json.cantidad === Number.NEGATIVE_INFINITY || json.cantidad === Number.POSITIVE_INFINITY ) {
				errorPosicion.add('LIN-PED-ERR-002', 'El parámetro "cantidad" es inválido', 400);
			}
		}

		// Añadimos las incidencias a la linea
		if (errorPosicion.hasError()) {
			this.sap_ignore = true;
			this.incidencias = errorPosicion.getErrors();
			L.xw(txId, ['Se ha descartado la línea de pedido por errores en la petición.', this.incidencias]);
		}


		// COPIA DE PROPIEDADES
		Object.assign(this, json);


	}
}


module.exports = LineaPedido;
