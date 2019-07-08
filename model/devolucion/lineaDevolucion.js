'use strict';
const BASE = global.BASE;
const L = global.logger;
const FedicomError = require(BASE + 'model/fedicomError');
const crypto = require('crypto');

class LineaDevolucion {
	constructor(json, txId, parent) {
		// SANEADO OBLIGATORIO

		// Nota: Por ahora no vamos a hacer saneado, queremos que SAP se busque la vida con esto
		/*
		var errorPosicion = new FedicomError();


		// 001 - Control de codigo de artículo
		if (!json.codigoArticulo) {
			errorPosicion.add('LIN-DEV-ERR-001', 'El campo "codigoArticulo" es inválido', 400);
		}

		// 002 - Control de la cantidad
		if (!json.cantidad) {
			errorPosicion.add('LIN-DEV-ERR-002', 'El campo "cantidad" es inválido', 400);
		} else {
			json.cantidad = Number(json.cantidad);
			if (!json.cantidad || json.cantidad <= 0 || json.cantidad === Number.NaN || json.cantidad === Number.NEGATIVE_INFINITY || json.cantidad === Number.POSITIVE_INFINITY ) {
				errorPosicion.add('LIN-PED-ERR-002', 'El parámetro "cantidad" es inválido', 400);
			}
		}

		// Añadimos las incidencias a la linea

		if (errorPosicion.hasError()) {
			this.incidencias = errorPosicion.getErrors();
			L.xw(txId, ['Se ha descartado la línea de devolución por errores en la petición.', this.incidencias]);
		}
		*/
		// FIN DEL SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// Generacion de CRC de línea
		this.generateCRC();

		L.xi(txId, ['Generado CRC de linea', this.crc], 'txCRC');

	}

	generateCRC() {
		var crc = '';
		crc += this.numeroAlbaran;
		crc += this.codigoArticulo;
		crc += this.cantidad;
		crc += this.valeEstupefaciente;
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(crc).digest('hex');
	}
}


module.exports = LineaDevolucion;
