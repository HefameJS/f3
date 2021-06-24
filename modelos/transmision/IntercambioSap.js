'use strict';
const C = global.config;
const K = global.constants;


const axios = require('axios');
const ErrorLlamadaSap = require('modelos/transmision/ErrorLlamadaSap');

/**
 * Clase que representa una única petición HTTP a SAP
 */
class IntercambioSap {

	#transmision;						// Referencia a la transmisión que origina el intercambio con SAP
	log;								// Referencia a this.#transmision.log;

	#intercambioEjecutado;				// Indica si se ha intentado realizar el intercambio
	#timeout;
	#funcionValidadora;					// Funcion a la que se llamará con la respuesta de SAP para determinar si esta es correcta o no.

	#solicitud = {
		fecha: null,
		url: null,
		metodo: null,
		headers: null,
		body: null
	}

	#respuesta = {
		fecha: null,
		estado: null,
		error: null,
		headers: null,
		body: null
	}


	constructor(transmision) {
		this.#transmision = transmision;
		this.log = this.#transmision.log;

		this.#intercambioEjecutado = false;
		this.#timeout = C.sap.timeout.realizarPedido;
		this.#funcionValidadora = IntercambioSap.validador.estandard;
	}

	setTimeout(timeout) {
		this.#timeout = timeout;
		return this;
	}

	setFuncionValidadora(fValidadora) {
		this.#funcionValidadora = fValidadora;
		return this;
	}

	async get(url) {
		let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
			method: 'GET',
			url: url,
			timeout: this.#timeout
		});
		return await this.#ejecutarLlamadaSap(parametrosHttp);
	}

	async post(url, body) {
		let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
			method: 'POST',
			url: url,
			timeout: this.#timeout,
			body: body
		});
		return await this.#ejecutarLlamadaSap(parametrosHttp);
	}

	
	getRespuesta() {
		return this.#respuesta.body;
	}

	getError() {
		return this.#respuesta.error;
	}

	intercambioEjecutado() {
		return this.#intercambioEjecutado;
	}

	generarMetadatosSap() {
		if (!this.#intercambioEjecutado) return undefined;

		return {
			metadatos: {
				servidor: this.#respuesta.headers?.['x-servidor-sap']?.toLowerCase?.() || null,
				error: this.#respuesta.error?.tipo || undefined,
				codigoEstado: this.#respuesta.estado || null,
				tiempoRespuesta: parseInt(this.#respuesta.headers?.['sap-perf-fesrec']) ?? null
			},
			solicitud: {
				fechaEnvio: this.#solicitud.fecha,
				url: this.#solicitud.url,
				metodo: this.#solicitud.metodo,
				headers: this.#solicitud.headers,
				body: this.#solicitud.body || undefined
			},
			respuesta: {
				fechaRecepcion: this.#respuesta.fecha,
				estado: this.#respuesta.estado || undefined,
				headers: this.#respuesta.headers || undefined,
				body: this.#respuesta.body || undefined,
				error: this.#respuesta.error || undefined
			}

		}
	}


	async #ejecutarLlamadaSap(parametros) {

		
		this.#intercambioEjecutado = true;
		this.#solicitud = {
			fecha: new Date(),
			url: parametros.url,
			metodo: parametros.method,
			headers: parametros.headers,
			body: parametros.body || undefined
		}

		let errorLlamadaSap = undefined;
		let respuestaSap = undefined;


		this.#transmision.setEstado(K.ESTADOS.PETICION_ENVIADA_A_SAP);

		try {
			respuestaSap = await axios(parametros);
			
			if (!this.#funcionValidadora(respuestaSap.status, respuestaSap.data)) {
				this.log.err('La llamada SAP ha devuelto un codigo de estado erróneo');
				errorLlamadaSap = new ErrorLlamadaSap(ErrorLlamadaSap.ERROR_RESPUESTA_HTTP, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
			}

		} catch (errorComunicacion) {
			this.log.err('La llamada SAP no se ha podido realizar por un error en la comunicación', errorComunicacion);
			errorLlamadaSap = new ErrorLlamadaSap(ErrorLlamadaSap.ERROR_SAP_INALCANZABLE, errorComunicacion.errno, errorComunicacion.code)
		}

		this.#respuesta = {
			fecha: new Date(),
			estado: respuestaSap?.status,
			error: errorLlamadaSap,
			headers: respuestaSap?.headers,
			body: respuestaSap?.data
		}

		this.#transmision.setEstado(K.ESTADOS.OBTENIDA_RESPUESTA_DE_SAP);

		if (errorLlamadaSap) throw errorLlamadaSap;
		return respuestaSap?.data

	}

}


/**
 * Los validadores son funciones que se ejecutan al finalizar la llamada a SAP y que determinan (devuelven true o false) si la ejecución de la llamada
 * ha sido correcta (return true) o ha sucedido un error (return false).
 * De manera general usaremos el validador por defecto 'estandard' que simplemente comprueba que la respuesta tenga un código de estado 2xx
 * pero en ciertas llamadas a SAP, es posible que queramos aceptar respuestas 500 si el cuerpo de la respuesta cumple ciertos requisitos, etc ...
 */
IntercambioSap.validador = {
	estandard: function (estado, body) {
		return Math.floor(estado / 100) === 2
	},

	consultaAlbaranJSON: function (estado, body) {
		if (IntercambioSap.validador.estandard(estado, body)) return true;

		// Cuando el albarán no existe, SAP devuelve un código HTTP 503 y en el cuerpo de respuesta:
		// {type: 'E', id: 'E202004011151', .... , message: 'La informacion no esta disponible..'
		return (estado === 503 && body?.message === 'La informacion no esta disponible..')
	},

	consultaDevolucionPDF: function (estado, body) {
		if (IntercambioSap.validador.estandard(estado, body)) return true;

		// Cuando la devolución no existe, SAP devuelve un 500 y la incidencia:
		// [ { id: 4, message: 'Error en la generacion del PDF' } ]

		return (estado === 500 &&
			Array.isArray(body) &&
			body[0]?.id === 4 &&
			body[0]?.message === 'Error en la generacion del PDF');
	}
}



module.exports = IntercambioSap;