'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');

// Helpers
const FieldChecker = require('util/fieldChecker');

/**
 * Esta clase representa una confirmacion de las lineas de un albarán.
 * 
 * {
 * 	numeroAlbaran: "AB54545455",
 * 	fechaAlbaran": "02/12/2017,
 * 	lineas: [
 * 		{
 * 			codigoArticulo: "84021545454574",
 * 			lote: "16L4534",
 * 			fechaCaducidad: "01/05/2017"
 * 		}
 * }
 */
class ConfirmacionAlbaran {
	constructor(req) {
		//this.original = cab;

		let txId = req.txId;
		let json = req.body;

		// SANEADO OBLIGATORIO
		let errorFedicom = new ErrorFedicom();

		FieldChecker.checkExistsAndNotEmptyString(json.numeroAlbaran, errorFedicom, 'CONF-ERR-001', 'El parámetro "numeroAlbaran" es inválido');
		FieldChecker.checkExistsAndDate(json.fechaAlbaran, errorFedicom, 'CONF-ERR-002', 'El parámetro "fechaAlbaran" es inválido');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, errorFedicom, 'LOG-ERR-004', 'El campo "lineas" no puede estar vacío');

		if (errorFedicom.hasError()) {
			L.xe(txId, 'La confirmación del albarán contiene errores de cabecera. Se aborta el procesamiento de la misma');
			throw errorFedicom;
		}
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// INFORMACION DE LOGIN INCLUIDA EN LA CONFIRMACION
		/*
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}
		*/

		// SANEADO DE LINEAS
		let [lineas/*, ignorarTodasLineas*/] = _analizarPosiciones(txId, json);
		this.lineas = lineas;
		// this.ignorarTodasLineas = ignorarTodasLineas;
		
	}
}



const _analizarPosiciones = (txId, json) => {
	let lineas = [];
	let ordenes = [];
	let ignorarTodasLineas = true;

	json.lineas.forEach((linea, i) => {
		let nuevaLinea = new LineaConfirmacionAlbaran(txId, linea);
		lineas.push(nuevaLinea);
		if (!nuevaLinea.sap_ignore) ignorarTodasLineas = false;

		if (nuevaLinea.orden) {
			ordenes.push(parseInt(nuevaLinea.orden));
		}
	})

	let nextOrder = 1;
	lineas.forEach((linea) => {
		if (!linea.orden) {
			while (ordenes.includes(nextOrder)) {
				nextOrder++;
			}
			linea.orden = nextOrder;
			nextOrder++;
		}
	});

	return [lineas, ignorarTodasLineas];
}



class LineaConfirmacionAlbaran {
	constructor(txId, posicion) {

		// COPIA DE PROPIEDADES
		Object.assign(this, posicion);

		let errorFedicom = new ErrorFedicom();

		FieldChecker.checkExistsAndNotEmptyString(posicion.codigoArticulo, errorFedicom, 'LIN-CONF-ERR-001', 'El campo "codigoArticulo" es obligatorio');
		FieldChecker.checkDate(posicion.fechaCaducidad, errorFedicom, 'LIN-CONF-ERR-003', 'El campo "fechaCaducidad" es inválido');
		
		// Si hay error, añadimos las incidencias a la linea 
		if (errorFedicom.hasError()) {
			this.incidencias = errorFedicom.getErrors();
			L.xw(txId, ['Se ha descartado la línea de logística por errores en la misma.', this.incidencias]);
		}

	}
}






module.exports = ConfirmacionAlbaran;