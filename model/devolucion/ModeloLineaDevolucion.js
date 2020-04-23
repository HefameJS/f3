'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');
const CRC = require('model/CRC');

// Helpers
const FieldChecker = require('util/fieldChecker');

class LineaDevolucion {
	constructor(json, txId, index) {
		// SANEADO OBLIGATORIO

		// Nota: Por ahora no vamos a hacer saneado

		let errorFedicom = new ErrorFedicom();

		FieldChecker.checkPositive(json.orden, errorFedicom, 'LIN-DEV-ERR-999', 'El campo "orden" es inválido');
		FieldChecker.checkNotEmptyString(json.codigoArticulo, errorFedicom, 'LIN-DEV-ERR-003', 'El campo "codigoArticulo" es obligatorio');
		FieldChecker.checkExistsAndPositive(json.cantidad, errorFedicom, 'LIN-PED-ERR-004', 'El campo "cantidad" es incorrecto');
		FieldChecker.checkExistsAndPositive(json.codigoMotivo, errorFedicom, 'LIN-DEV-ERR-005', 'El campo "codigoMotivo" es obligatorio');

		// 004 y 005 - numeroAlbaran y fechaAlbaran
		FieldChecker.checkNotEmptyString(json.numeroAlbaran, errorFedicom, 'LIN-DEV-ERR-001', 'El campo "numeroAlbaran" es obligatorio');
		FieldChecker.checkExistsAndDate(json.fechaAlbaran, errorFedicom, 'LIN-DEV-ERR-002', 'El campo "fechaAlbaran" es incorrecto');


		// Añadimos las incidencias a la linea y la marcamos para no procesar
		if (errorFedicom.hasError()) {
			L.xw(txId, ['Se ha detectado un error en una línea de devolución.', errorFedicom]);
			this.excluir = true;
			this.incidencias = errorFedicom.getErrors()
		}

		// FIN DEL SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// Generacion de CRC de línea
		this.generateCRC();
		L.xd(txId, ['Generado CRC de linea', this.crc], 'txCRC');

	}


	generateCRC() {
		this.crc = CRC.crearParaLineaDevolucion(
			this.codigoMotivo, 
			this.numeroAlbaran, 
			this.fechaAlbaran, 
			this.codigoArticulo, 
			this.cantidad, 
			this.lote, 
			this.fechaCaducidad, 
			this.valeEstupefaciente
		)
	}

}


module.exports = LineaDevolucion;
