'use strict';
//const C = global.config;
//const K = global.constants;

const Modelo = require("modelos/transmision/Modelo");
const Validador = require("global/validador");
const ErrorFedicom = require("modelos/ErrorFedicom");

/*
 * 		{
 * 			codigoArticulo: "84021545454574",
 * 			lote: "16L4534",
 * 			fechaCaducidad: "01/05/2017"
 * 		}
 */
class LineaConfirmacionAlbaran extends Modelo {

	metadatos = {
		numeroLinea: 0,
		errores: new ErrorFedicom(),
		errorProtocolo: false
	}

	codigoArticulo;
	lote;
	fechaCaducidad;

	constructor(transmision, json, numeroLinea) {
		super(transmision);

		this.metadatos.numeroLinea = numeroLinea;

		this.log.debug(`Posición ${this.metadatos.numeroLinea}: Analizando linea de confirmación de albarán`);
		

		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-CONF-ERR-001', 'El campo "codigoArticulo" es obligatorio');
		Validador.esFecha(json.fechaCaducidad, errorFedicom, 'LIN-CONF-ERR-003', 'El campo "fechaCaducidad" es inválido');

		// Si hay error, añadimos las incidencias a la linea 
		if (errorFedicom.tieneErrores()) {
			L.xw(txId, ['Se descarta la línea de confirmación de albaran por errores en la misma.', numeroPosicion, this.incidencias]);
			this.metadatos.errores = errorFedicom;
			this.metadatos.errorProtocolo = true;
			
		}

		this.codigoArticulo = json.codigoArticulo?.trim?.();
		this.fechaCaducidad = json.fechaCaducidad?.trim?.();

		if (Validador.esCadenaNoVacia(json.lote)) {
			this.lote = json.lote.trim();
		}

	}

	generarJSON() {
		let json = {
			codigoArticulo: this.codigoArticulo,
			fechaCaducidad: this.fechaCaducidad
		}
		if (this.lote) json.lote = this.lote
		if (this.metadatos.errores.tieneErrores()) json.incidencias = this.metadatos.errores.getErrores();
		return json;
	}
}


module.exports = LineaConfirmacionAlbaran;