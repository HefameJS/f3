'use strict';
const BASE = global.BASE;
const L = global.logger;
const FedicomError = require(BASE + 'model/fedicomError');
const crypto = require('crypto');

class LineaDevolucion {
	constructor(json, txId, parent) {
		// SANEADO OBLIGATORIO

		// Nota: Por ahora no vamos a hacer saneado

		var errorPosicion = new FedicomError();


		// 001 - Control de codigo de artículo
		if (!json.codigoArticulo) {
			errorPosicion.add('LIN-DEV-ERR-001', 'El campo "codigoArticulo" es obligatorio', 400);
		}

		// 002 - Control de la cantidad
		if (!json.cantidad) {
			errorPosicion.add('LIN-DEV-ERR-002', 'El campo "cantidad" es obligatorio', 400);
		} else {
			json.cantidad = Number(json.cantidad);
			if (!json.cantidad || json.cantidad <= 0 || json.cantidad === Number.NaN || json.cantidad === Number.NEGATIVE_INFINITY || json.cantidad === Number.POSITIVE_INFINITY ) {
				errorPosicion.add('LIN-PED-ERR-002', 'El parámetro "cantidad" es incorrecto', 400);
			}
		}

		// 003 - Control del codigo de motivo
		if (!json.codigoMotivo) {
			errorPosicion.add('LIN-DEV-ERR-003', 'El campo "codigoMotivo" es obligatorio', 400);
		} else {
			var codigoMotivo = Number(json.codigoMotivo);
			if (!codigoMotivo || codigoMotivo <= 0 || codigoMotivo > 10 || codigoMotivo === Number.NaN || codigoMotivo === Number.NEGATIVE_INFINITY || codigoMotivo === Number.POSITIVE_INFINITY ) {
				errorPosicion.add('LIN-PED-ERR-003', 'El parámetro "codigoMotivo" es incorrecto', 400);
			}
		}

		// 004 - numeroAlbaran y fechaAlbaran
		var codigoMotivo = Number(json.codigoMotivo);
		if (codigoMotivo !== 1 && codigoMotivo !== 2) { // Si no es 01 - Caducidad o 02 - Alerta sanitaria
			if (!json.numeroAlbaran) errorPosicion.add('LIN-DEV-ERR-004', 'El campo "numeroAlbaran" es obligatorio', 400);
			if (!json.fechaAlbaran) errorPosicion.add('LIN-DEV-ERR-005', 'El campo "fechaAlbaran" es obligatorio', 400);
		}

		// Añadimos las incidencias a la linea

		if (errorPosicion.hasError()) {
			this.procesar = false;
			this.incidencias = errorPosicion.getErrors();
			L.xw(txId, ['Se ha descartado la línea de devolución por errores en la petición.', this.incidencias]);
		}

		// FIN DEL SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// Generacion de CRC de línea
		this.generateCRC();

		L.xi(txId, ['Generado CRC de linea', this.crc], 'txCRC');

	}

	generateCRC() {
		var crc = '';
		if (this.numeroAlbaran) crc += this.numeroAlbaran;
		if (this.codigoArticulo) crc += this.codigoArticulo;
		if (this.codigoMotivo) crc += this.codigoMotivo;
		if (this.cantidad) crc += this.cantidad;
		if (this.valeEstupefaciente) crc += this.valeEstupefaciente;
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(crc).digest('hex');
	}
}


module.exports = LineaDevolucion;
