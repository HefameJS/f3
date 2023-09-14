"use strict";
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require("modelos/ErrorFedicom");

// Utiles
const Validador = require("global/validador");

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
 * 			fechaCaducidad: "01/05/2017",
 * 			cantidad: 1
 * 		}
 * }
 */
class ConfirmacionAlbaran {
	constructor(req) {
		//this.original = cab;

		let txId = req.txId;
		let json = req.body;
		this.txId = txId;

		this.metadatos = {
			ignorarTodasLineas: true,
		};

		// SANEADO OBLIGATORIO
		let errorFedicom = new ErrorFedicom();

		Validador.esCadenaNoVacia(json.numeroAlbaran, errorFedicom, "CONF-ERR-001", 'El parámetro "numeroAlbaran" es inválido');
		Validador.esFecha(json.fechaAlbaran, errorFedicom, "CONF-ERR-002", 'El parámetro "fechaAlbaran" es inválido');
		Validador.esArrayNoVacio(json.lineas, errorFedicom, "CONF-ERR-004", 'El parámetro "lineas" es inválido');

		if (errorFedicom.tieneErrores()) {
			L.xw(txId, "La confirmación del albarán contiene errores de cabecera. Se aborta el procesamiento de la misma");
			throw errorFedicom;
		}

		// Copiamos la información del mensaje
		this.numeroAlbaran = json.numeroAlbaran.trim();
		this.fechaAlbaran = json.fechaAlbaran.trim();
		this.#analizarPosiciones(json.lineas);

		this.login = {
			username: req.token.sub,
			domain: req.token.aud,
		};
	}

	#analizarPosiciones(json) {
		this.lineas = [];
		let ordenes = [];

		json.forEach((linea, i) => {
			let nuevaLinea = new LineaConfirmacionAlbaran(linea, this.txId, i);
			this.lineas.push(nuevaLinea);

			if (!nuevaLinea.metadatos.ignorar) this.metadatos.ignorarTodasLineas = false;

			if (nuevaLinea.orden) {
				ordenes.push(parseInt(nuevaLinea.orden));
			}
		});

		let siguienteOrdinal = 1;
		this.lineas.forEach((linea) => {
			if (!linea.orden) {
				while (ordenes.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.orden = siguienteOrdinal;
				siguienteOrdinal++;
			}
		});
	}

	generarJSON() {
		return {
			numeroAlbaran: this.numeroAlbaran,
			fechaAlbaran: this.fechaAlbaran,
			lineas: this.lineas.map((linea) => linea.generarJSON()),
		};
	}
}

/*
 * 		{
 * 			codigoArticulo: "84021545454574",
 * 			lote: "16L4534",
 * 			fechaCaducidad: "01/05/2017"
 * 		}
 */
class LineaConfirmacionAlbaran {
	constructor(json, txId, numeroPosicion) {
		L.xt(txId, ["Analizando linea de confirmación en posición " + numeroPosicion]);
		this.metadatos = {
			ignorar: false,
		};

		let errorFedicom = new ErrorFedicom();

		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, "LIN-CONF-ERR-001", 'El campo "codigoArticulo" es obligatorio');
		
		// Si hay error, añadimos las incidencias a la linea
		if (errorFedicom.tieneErrores()) {
			L.xw(txId, ["Se descarta la línea de confirmación de albaran por errores en la misma.", numeroPosicion, this.incidencias]);
			this.incidencias = errorFedicom.getErrores();
			this.metadatos.ignorar = true;
			return;
		}

		if (json.fechaCaducidad && !Validador.esFecha(json.fechaCaducidad))  {
			let incidencia = new ErrorFedicom("LIN-CONF-ERR-003", 'El campo "fechaCaducidad" es inválido');
			this.incidencias = incidencia.getErrores();
		}

		this.codigoArticulo = json.codigoArticulo.trim();
		this.lote = json.lote;
		this.fechaCaducidad = json.fechaCaducidad;
		this.unidades = parseInt(json.unidades, 10) || 1;
	}

	generarJSON() {
		let json = {
			codigoArticulo: this.codigoArticulo,
			fechaCaducidad: this.fechaCaducidad,
			unidades: this.unidades
		};
		if (this.lote) json.lote = this.lote;
		if (this.incidencias) json.incidencias = this.incidencias;
		return json;
	}
}

module.exports = ConfirmacionAlbaran;
