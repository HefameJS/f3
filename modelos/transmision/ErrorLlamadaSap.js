'use strict';

/**
 * Representa un error en la llamada a SAP. 
 */
class ErrorLlamadaSap {

	#tipo;
	#cuerpoRespuesta;

	origen;
	codigo;
	mensaje;

	constructor(tipo, codigo, mensaje , cuerpoRespuesta) {
		
		let origen = 'UNK';
		switch (tipo) {
			case ErrorLlamadaSap.ERROR_RESPUESTA_HTTP:
				origen = 'SAP';
				break;
			case ErrorLlamadaSap.ERROR_SAP_INALCANZABLE:
				origen = 'NET';
				break;
		}

		this.#tipo = tipo;
		this.#cuerpoRespuesta = cuerpoRespuesta;
		this.origen = origen;
		this.codigo = codigo || null;
		this.mensaje = mensaje || 'Sin descripción del error';

	}

	getTipo() {
		return this.#tipo;
	}

	getCuerpoRespuesta() {
		return this.#cuerpoRespuesta;
	}

	esErrorHttpSap() {
		return this.#tipo === ErrorLlamadaSap.ERROR_RESPUESTA_HTTP;
	}

	esSapNoAlcanzable() {
		return this.#tipo === ErrorLlamadaSap.ERROR_SAP_INALCANZABLE;
	}

}

ErrorLlamadaSap.ERROR_RESPUESTA_HTTP = 2
ErrorLlamadaSap.ERROR_SAP_INALCANZABLE = 3

module.exports = ErrorLlamadaSap;