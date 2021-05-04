'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

const CODIGO_HTTP_POR_DEFECTO = 500;

class ErrorFedicom {

	constructor(codigoError, descripcion, codigoRespuestaHttp = CODIGO_HTTP_POR_DEFECTO) {
		this.listaErroresFedicom = [];
		this.codigoRespuestaHttp = codigoRespuestaHttp;

		if (codigoError) {
			this.insertar(codigoError, descripcion, codigoRespuestaHttp);
		}
	}

	/**
	 * Inserta el error en la lista de errores.
	 * Se admiten los distintos tipos de errores:
	 * - Si error y descripcion son Strings, se asume que se inserta el codigo y descripcion del error.
	 * - Si error es un error de express.
	 * - Excepciones.
	 * - Otras instancias de ErrorFedicom.
	 * - Cualquier otro tipo de objeto se indica un error genérico.
	 * @param {*} error 
	 * @param {*} descripcion 
	 * @param {*} codigoRespuestaHttp 
	 * @returns 
	 */
	insertar(error, descripcion, codigoRespuestaHttp = CODIGO_HTTP_POR_DEFECTO) {

		// Se llama utilizando codigo y descripción que son Strings
		if (error && descripcion && typeof error === 'string' && typeof descripcion === 'string') {
			this.listaErroresFedicom.push({ codigo: error, descripcion: descripcion });
			if (codigoRespuestaHttp) this.codigoRespuestaHttp = parseInt(codigoRespuestaHttp) || CODIGO_HTTP_POR_DEFECTO;
			return this;
		}

		// Se llama pasando un objeto de incidencia Fedicom3 {codigo: "String", descripcion: "String"}
		if (error && error.codigo && error.descripcion && typeof error.codigo === 'string' && typeof error.descripcion === 'string') {
			this.listaErroresFedicom.push({ codigo: error.codigo, descripcion: error.descripcion });
			return this;
		}

		// Se llama utilizando un error devuelto por Express
		if (error && error.type && error.statusCode) {
			this.codigoRespuestaHttp = parseInt(error.statusCode) || this.codigoRespuestaHttp;

			// entity.parse.failed -> No se pudo convertir el cuerpo del body a JSON
			if (error.type === 'entity.parse.failed') {
				this.codigoRespuestaHttp = 400;
				this.listaErroresFedicom.push({ codigo: 'HTTP-400', descripcion: 'No se entiende el cuerpo del mensaje' });
			} else {
				L.f('ERROR EXPRESS NO CONTROLADO: ' + error.type);
				this.listaErroresFedicom.push({ codigo: 'HTTP-500', descripcion: 'Error desconocido [' + error.type + ']' });
			}
			return this;
		}

		// Se llama pasando otro error Fedicom
		if (error && error.constructor.name === 'ErrorFedicom') {
			this.listaErroresFedicom = [...this.listaErroresFedicom, ...error.listaErroresFedicom];
			if (codigoRespuestaHttp) this.codigoRespuestaHttp = parseInt(codigoRespuestaHttp) || CODIGO_HTTP_POR_DEFECTO;
			return this;
		}

		// Se llama pasando una Excepcion
		if (error && error.stack) {

			let errorToLog = '';
			if (error.stack && error.stack.split) {
				errorToLog = error.stack.split(/\r?\n/);
			}

			L.e(['Se convirtió una excepción en un ErrorFedicom', errorToLog, error]);

			this.listaErroresFedicom.push({
				codigo: 'HTTP-ERR-500',
				descripcion: 'Error interno del servidor - '
			});

			if (codigoRespuestaHttp) this.codigoRespuestaHttp = parseInt(codigoRespuestaHttp) || CODIGO_HTTP_POR_DEFECTO;
			return this;
		}

		// Si los parámetros de la llamada no son válidos
		L.f(['Se inserta un error desconocido', error]);
		this.listaErroresFedicom.push({ codigo: 'HTTP-500', descripcion: 'Error desconocido' });
		return this;
	}

	tieneErrores() {
		return (this.listaErroresFedicom.length > 0)
	}

	getErrores() {
		return this.listaErroresFedicom;
	}


	enviarRespuestaDeError(expressRes, codigoHttp) {
		codigoHttp = codigoHttp || this.codigoRespuestaHttp || CODIGO_HTTP_POR_DEFECTO;
		if (!expressRes.headersSent)
			expressRes.status(codigoHttp).json(this.listaErroresFedicom);
		return this.listaErroresFedicom;
	}


	/**
	 * Este método provee un atajo para enviar un único codigo de error Fedicom al cliente.
	 * @param {*} expressRes El objeto de respuesta HTTP de express
	 * @param {*} codigo El código del error Fedicom (i.e. AUTH-004, LIN-PED-ERR-001, etc...)
	 * @param {*} descripcion El texto descriptivo del error
	 * @param {*} codigoRespuestaHTTP El código de respuesta HTTP asociado al error
	 */
	static generarYEnviarError(expressRes, codigo, descripcion, codigoRespuestaHTTP) {
		let errorFedicom = new ErrorFedicom(codigo, descripcion, codigoRespuestaHTTP);
		return errorFedicom.enviarRespuestaDeError(expressRes);
	}

	/**
	 * Genera y envía un error fedicom para las respuestas erroneas que da el proceso monitor.
	 * 
	 * @param {*} expressRes 
	 * @param {*} descripcion 
	 * @param {*} codigoRespuestaHTTP 
	 */
	static generarYEnviarErrorMonitor(expressRes, descripcion, codigoRespuestaHTTP) {
		return ErrorFedicom.generarYEnviarError(expressRes, 'MONITOR-ERR-999', descripcion, codigoRespuestaHTTP || 500);
	}
}

module.exports = ErrorFedicom;
