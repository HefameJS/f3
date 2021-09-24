'use strict';

const ResultadoTransmision = require("modelos/transmision/ResultadoTransmision");
const ResultadoTransmisionLigera = require("./transmision/ResultadoTransmisionLigera");

const CODIGO_HTTP_POR_DEFECTO = 500;

class ErrorFedicom {

	#listaErroresFedicom = [];
	#codigoRespuestaHttp = null;

	static esErrorFedicom(objeto) {
		return ErrorFedicom.prototype.isPrototypeOf(objeto);
	}

	/**
	 * Instancia la clase e inserta el error pasado en los parámetros si se especifica.
	 * Ver método insertar() para detalles de como se insertan los errores.
	 */
	constructor(codigoError, descripcion, codigoRespuestaHttp = CODIGO_HTTP_POR_DEFECTO) {
		this.#listaErroresFedicom = [];

		if (codigoError) {
			this.insertar(codigoError, descripcion, codigoRespuestaHttp);
		}
	}


	getCodigoRespuestaHttp() {
		return this.#codigoRespuestaHttp;
	}

	/**
	 * Inserta el error en la lista de errores.
	 * Se admiten los distintos tipos de errores:
	 * - Si error y descripcion son Strings, se asume que se inserta el codigo y descripcion del error.
	 * - Un objeto de error en formato Fedicom3: {codigo: "String", descripcion: "String"}
	 * - Si error es un error de express.
	 * - Otras instancias de ErrorFedicom, en cuyo caso fusiona las listas de errores.
	 * - Excepciones.
	 * - Cualquier otro tipo de objeto se indica un error genérico.
	 * @param {*} error 
	 * @param {*} descripcion 
	 * @param {*} codigoRespuestaHttp 
	 * @returns 
	 */
	insertar(error, descripcion, codigoRespuestaHttp = CODIGO_HTTP_POR_DEFECTO) {

		// Se llama utilizando codigo y descripción que son Strings
		if (error && descripcion && typeof error === 'string' && typeof descripcion === 'string') {
			this.#listaErroresFedicom.push({ codigo: error, descripcion: descripcion });
			if (codigoRespuestaHttp) this.#codigoRespuestaHttp = parseInt(codigoRespuestaHttp) || CODIGO_HTTP_POR_DEFECTO;
			return this;
		}

		// Se llama pasando un objeto de incidencia Fedicom3 {codigo: "String", descripcion: "String"}
		if (error?.codigo && error.descripcion && typeof error.codigo === 'string' && typeof error.descripcion === 'string') {
			this.#listaErroresFedicom.push({ codigo: error.codigo, descripcion: error.descripcion });
			return this;
		}

		// Se llama utilizando un error devuelto por Express
		if (error?.type && error.statusCode) {
			this.#codigoRespuestaHttp = parseInt(error.statusCode) || this.#codigoRespuestaHttp;

			// entity.parse.failed -> No se pudo convertir el cuerpo del body a JSON
			if (error.type === 'entity.parse.failed') {
				this.#codigoRespuestaHttp = 400;
				this.#listaErroresFedicom.push({ codigo: 'HTTP-400', descripcion: 'No se entiende el cuerpo del mensaje' });
			} else {
				this.#listaErroresFedicom.push({ codigo: 'HTTP-500', descripcion: 'Error desconocido [' + error.type + ']' });
			}
			return this;
		}

		// Se llama pasando otro error Fedicom
		if (ErrorFedicom.esErrorFedicom(error)) {
			codigoRespuestaHttp = error.codigoRespuestaHttp;
			this.#listaErroresFedicom = [...this.#listaErroresFedicom, ...error.#listaErroresFedicom];
			if (codigoRespuestaHttp) this.#codigoRespuestaHttp = parseInt(codigoRespuestaHttp) || CODIGO_HTTP_POR_DEFECTO;
			return this;
		}

		// Se llama pasando una Excepcion
		if (error?.stack) {

			let errorToLog = error.stack.split?.(/\r?\n/) || '';

			this.#listaErroresFedicom.push({
				codigo: 'HTTP-ERR-500',
				descripcion: 'Error interno del servidor: ' + errorToLog
			});

			if (codigoRespuestaHttp) this.#codigoRespuestaHttp = parseInt(codigoRespuestaHttp) || CODIGO_HTTP_POR_DEFECTO;
			return this;
		}

		// Si los parámetros de la llamada no son válidos
		L.warn('Insercion de error fedicom con parametros desconocidos', error);
		this.#listaErroresFedicom.push({ codigo: 'HTTP-500', descripcion: 'Error desconocido' });
		return this;
	}

	tieneErrores() {
		return (this.#listaErroresFedicom.length > 0)
	}

	getErrores() {
		return this.#listaErroresFedicom;
	}



	generarResultadoTransmision(estado) {
		if (!estado) return new ResultadoTransmisionLigera(this.#codigoRespuestaHttp, this.getErrores())
		return new ResultadoTransmision(this.#codigoRespuestaHttp, estado, this.getErrores())
	}





}




module.exports = ErrorFedicom;
