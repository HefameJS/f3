'use strict';

const FedicomError = require('./fedicomError');

const L = global.logger;

class LineaPedido {
	constructor(json, txId) {
		// SANEADO OBLIGATORIO

		var fedicomError = new FedicomError();
		// if (json.orden === undefined) fedicomError.add('LIN-PED-ERR-001', 'El campo "orden" es obligatorio. Se descarta la línea.', 400);
		if (!json.codigoArticulo) fedicomError.add('LIN-PED-ERR-002', 'El campo "codigoArticulo" es obligatorio', 400);
		if (!json.cantidad) fedicomError.add('LIN-PED-ERR-003', 'El campo "cantidad" es obligatorio', 400);
		if (fedicomError.hasError()) {
			this.incidencias = fedicomError.getErrors();
			L.xw(txId, ['Se ha descartado la línea de pedido por un error en la petición.', this.incidencias]);
		}
		// FIN SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);
	}
}


module.exports = LineaPedido;