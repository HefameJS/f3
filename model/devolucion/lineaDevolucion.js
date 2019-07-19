'use strict';
const BASE = global.BASE;
const L = global.logger;
const FedicomError = require(BASE + 'model/fedicomError');
const crypto = require('crypto');
const FieldChecker = require(BASE + 'util/fieldChecker');

class LineaDevolucion {
	constructor(json, txId, parent) {
		// SANEADO OBLIGATORIO

		// Nota: Por ahora no vamos a hacer saneado

		var errorPosicion = new FedicomError();

		FieldChecker.checkExists(json.codigoArticulo, errorPosicion, 'LIN-DEV-ERR-001', 'El campo "codigoArticulo" es obligatorio');
		FieldChecker.checkExistsAndPositiveInteger(json.cantidad, errorPosicion, 'LIN-PED-ERR-002', 'El campo "cantidad" es incorrecto');
		FieldChecker.checkExistsAndPositiveInteger(json.codigoMotivo, errorPosicion, 'LIN-DEV-ERR-003', 'El campo "codigoMotivo" es obligatorio');

		// 004 - numeroAlbaran y fechaAlbaran
		var codigoMotivo = Number(json.codigoMotivo);
		if (codigoMotivo !== 1 && codigoMotivo !== 2) { // Si no es 01 - Caducidad o 02 - Alerta sanitaria
			FieldChecker.checkExists(json.numeroAlbaran, errorPosicion, 'LIN-DEV-ERR-004', 'El campo "numeroAlbaran" es obligatorio');
			FieldChecker.checkExists(json.fechaAlbaran, errorPosicion, 'LIN-DEV-ERR-005', 'El campo "fechaAlbaran" es obligatorio');
		}

		// Añadimos las incidencias a la linea

		if (errorPosicion.hasError()) {
			this.sap_ignore = true;
			this.incidencias = errorPosicion.getErrors();
			if (json.cantidad) this.cantidadFalta = json.cantidadbonificacion;
			if (json.cantidadbonificacion) this.cantidadBonificacionFalta = json.cantidadbonificacion;
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
