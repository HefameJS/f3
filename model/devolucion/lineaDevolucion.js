'use strict';
const BASE = global.BASE;
const L = global.logger;
const FedicomError = require(BASE + 'model/fedicomError');
const crypto = require('crypto');
const FieldChecker = require(BASE + 'util/fieldChecker');

class LineaDevolucion {
	constructor(json, txId, index) {
		// SANEADO OBLIGATORIO

		// Nota: Por ahora no vamos a hacer saneado

		var errorPosicion = new FedicomError();

		FieldChecker.checkPositive(json.orden, errorPosicion, 'LIN-DEV-ERR-999', 'El campo "orden" es inválido');
		FieldChecker.checkNotEmptyString(json.codigoArticulo, errorPosicion, 'LIN-DEV-ERR-003', 'El campo "codigoArticulo" es obligatorio');
		FieldChecker.checkExistsAndPositive(json.cantidad, errorPosicion, 'LIN-PED-ERR-004', 'El campo "cantidad" es incorrecto');
		FieldChecker.checkExistsAndPositive(json.codigoMotivo, errorPosicion, 'LIN-DEV-ERR-005', 'El campo "codigoMotivo" es obligatorio');

		// 004 y 005 - numeroAlbaran y fechaAlbaran
		FieldChecker.checkNotEmptyString(json.numeroAlbaran, errorPosicion, 'LIN-DEV-ERR-001', 'El campo "numeroAlbaran" es obligatorio');
		FieldChecker.checkExistsAndDate(json.fechaAlbaran, errorPosicion, 'LIN-DEV-ERR-002', 'El campo "fechaAlbaran" es incorrecto');
		

		// Añadimos las incidencias a la linea y la marcamos para no procesar
		if (errorPosicion.hasError()) {
			L.xw(txId, ['Se ha detectado un error en una línea de devolución.', errorPosicion]);
			this.excluir = true;
			this.incidencias = errorPosicion.getErrors()
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
		if (this.lote) crc += this.lote;
		if (this.fechaCaducidad) crc += this.fechaCaducidad;
		if (this.valeEstupefaciente) crc += this.valeEstupefaciente;
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(crc).digest('hex');
	}
}


module.exports = LineaDevolucion;
