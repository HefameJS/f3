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

		FieldChecker.checkPositive(json.orden, errorPosicion, 'LIN-DEV-ERR-999', 'El campo "orden" es inválido para la línea en posición ' + (index+1));
		FieldChecker.checkExists(json.codigoArticulo, errorPosicion, 'LIN-DEV-ERR-001', 'El campo "codigoArticulo" es obligatorio para la línea en posición ' + (index+1));
		FieldChecker.checkExistsAndPositive(json.cantidad, errorPosicion, 'LIN-PED-ERR-002', 'El campo "cantidad" es incorrecto para la línea en posición ' + (index+1));
		FieldChecker.checkExistsAndPositive(json.codigoMotivo, errorPosicion, 'LIN-DEV-ERR-003', 'El campo "codigoMotivo" es obligatorio para la línea en posición ' + (index+1));

		// 004 y 005 - numeroAlbaran y fechaAlbaran
		FieldChecker.checkExists(json.numeroAlbaran, errorPosicion, 'LIN-DEV-ERR-004', 'El campo "numeroAlbaran" es obligatorio para la línea en posición ' + (index+1));
		FieldChecker.checkExistsAndDate(json.fechaAlbaran, errorPosicion, 'LIN-DEV-ERR-005', 'El campo "fechaAlbaran" es incorrecto para la línea en posición ' + (index+1));
		

		// Añadimos las incidencias a la linea

		if (errorPosicion.hasError()) {
			L.xw(txId, ['Se ha detectado un error en una línea de devolución.', errorPosicion]);
			throw errorPosicion;
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
