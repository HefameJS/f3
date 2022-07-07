'use strict';
const C = global.C;
const K = global.K;


const axios = require('axios');
const ErrorLlamadaSap = require('./ErrorLlamadaSap');

/**
 * Clase que representa una única petición HTTP a SAP
 */
class IntercambioSap {

	#transmision;						// Referencia a la transmisión que origina el intercambio con SAP
	log;								// Referencia a this.#transmision.log;

	#intercambioEjecutado;				// Indica si se ha intentado realizar el intercambio
	#timeout;							// Timeout a esperar antes de abortar la llamada HTTP
	#funcionValidadora;					// Funcion a la que se llamará con la respuesta de SAP para determinar si esta es correcta o no.
	#devuelveEnCrudo = false;			// Indica si las respuestas de SAP se devuelven tal cual AXIOS las retorna (con cabeceras y codigo de estado)



	#solicitud = {
		fecha: null,		// Hora a la que se genera la solicitud a SAP
		url: null,			// URL a la que se llama
		metodo: null,		// Método HTTP usado
		headers: null,		// Cabeceras de la petición
		body: null			// Cuerpo de la petición
	}

	#respuesta = {
		fecha: null,		// Hora de recepción de la respuesta
		estado: null,		// Codigo de estado HTTP
		error: null,		// Objeto de tipo ErrorLlamadaSap si hubo error al ejecutar la llamada, null si no hubo error
		headers: null,		// Cabeceras de la respuesta
		body: null			// Cuerpo de respuesta
	}

	/**
	 * Prepara el intercambiador para realizar la llamada a SAP
	 * @param {*} transmision La transmisión que realiza la llamada.
	 */
	constructor(transmision) {
		this.#transmision = transmision;
		this.log = this.#transmision.log;

		this.#intercambioEjecutado = false;
		this.#timeout = C.sap.timeout.realizarPedido;
		this.#funcionValidadora = IntercambioSap.validador.estandard;
	}

	/**
	 * Generalmente, tras una llamda a SAP se devuelve únicamente el cuerpo del mensaje retornado.
	 * Si activamos este flag, se devolverá el objeto de respuesta tal cual AXIOS lo retorna,
	 * con cabeceras y codigo de estado.
	 * @param {*} devuelveEnCrudo (true | false)
	 */
	setDevuelveEnCrudo(devuelveEnCrudo) {
		this.#devuelveEnCrudo = devuelveEnCrudo;
	}

	/**
	 * Establece el timeout tras el cual la petición a SAP será abortada.
	 * Por defecto, se establece el valor de `C.sap.timeout.realizarPedido`
	 * @param {*} timeout Número de segundos para esperar
	 * @returns 
	 */
	setTimeout(timeout) {
		this.#timeout = timeout;
		return this;
	}

	/**
	 * Función que se ejecutará para determinar si la respuesta de SAP es un error o no. Ver `IntercambioSap.validador`.
	 * Por omisión, la función validadora por defecto simplemente comprueba que el código de retorno sea de la forma 2xx.
	 * 
	 * Motivo principal de esta función: SAP funciona mal.
	 * Ejemplo: En algunos casos, como en la llamada a consultas de albaranes, que se devuelve un error 500 cuando no
	 * existe el albarán. Esto hace que, si no se comprueba, parezca que SAP está caído.
	 * @param {*} fnValidadora 
	 * @returns 
	 */
	setFuncionValidadora(fnValidadora) {
		this.#funcionValidadora = fnValidadora;
		return this;
	}

	/**
	 * Realiza una llamada GET a la URL indicada del sistema SAP destino configurado.
	 * Resuelve el body de la respuesta obtenido (o el objeto respuesta de AXIOS, ver `setDevuelveEnCrudo()`)
	 * En caso de error, hace reject con el mismo.
	 * @param {*} url 
	 * @returns 
	 */
	async get(url) {
		let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
			method: 'GET',
			url: url,
			timeout: this.#timeout
		});
		return await this.#ejecutarLlamadaSap(parametrosHttp);
	}

	/**
	 * Realiza una llamada POST a la URL indicada del sistema SAP destino configurado.
	 * Resuelve el body de la respuesta obtenido (o el objeto respuesta de AXIOS, ver `setDevuelveEnCrudo()`)
	 * En caso de error, hace reject con el mismo.
	 * @param {*} url 
	 * @param {*} body 
	 * @returns 
	 */
	async post(url, body) {
		let parametrosHttp = C.sap.destino.obtenerParametrosLlamada({
			method: 'POST',
			url: url,
			timeout: this.#timeout,
			body: body
		});
		return await this.#ejecutarLlamadaSap(parametrosHttp);
	}

	/**
	 * Obtiene el cuerpo de la respuesta devuelto por la llamada a SAP.
	 * @returns 
	 */
	getRespuesta() {
		return this.#respuesta.body;
	}

	/**
	 * Devuelve el error producido durante la llamada a SAP, si existe.
	 * Los errores son de tipo ErrorLlamadaSap
	 * @returns 
	 */
	getError() {
		return this.#respuesta.error;
	}

	/**
	 * Indica si la llamada a SAP se ha ejecutado ya o no.
	 * @returns 
	 */
	intercambioEjecutado() {
		return this.#intercambioEjecutado;
	}

	/**
	 * ***INTERNO***
	 * Esta función se invoca durante el flujo de ejecución de la transmisión, y no tiene demasiado
	 * sentido invocarla fuera de este flujo.
	 * Devuelve un objeto con los metadatos/resumen de la llamada a SAP, que será insertado en la 
	 * base de datos cuando se registre la transmisión.
	 * @returns 
	 */
	generarMetadatosSap() {
		if (!this.#intercambioEjecutado) return undefined;

		return {
			metadatos: {
				servidor: this.#respuesta.headers?.['x-servidor-sap']?.toLowerCase?.() || null,
				error: this.#respuesta.error?.getTipo() || undefined,
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

	/**
	 * Lanza una petición contra el destino SAP indicado en la configuración.
	 * 
	 * @param {*} parametros Es un objeto de la forma {
	 * 	url: La URL a la que hacer la petición
	 *  metodo: El método HTTP (GET, POST, PUT, DELETE)
	 *  headers: Las cabeceras de la petición
	 *  body: El cuerpo del mensaje de la petición
	 * }
	 * @returns 
	 */
	async #ejecutarLlamadaSap(parametros) {

		this.#intercambioEjecutado = true;
		this.#solicitud = {
			fecha: new Date(),
			url: parametros.url,
			metodo: parametros.method,
			headers: parametros.headers,
			body: parametros.data || undefined
		}

		let errorLlamadaSap = undefined;
		let respuestaSap = undefined;


		this.#transmision.setEstado(K.ESTADOS.PETICION_ENVIADA_A_SAP);

		try {
			respuestaSap = await axios(parametros);

			// Con la respuesta obtenida, llamamos a la función validadora (si existe), que debe retornar un booleano.
			if (!this.#funcionValidadora(respuestaSap.status, respuestaSap.data)) {
				this.log.err(`La llamada SAP ha devuelto un codigo de estado ${respuestaSap.status}`);
				errorLlamadaSap = new ErrorLlamadaSap(ErrorLlamadaSap.ERROR_RESPUESTA_HTTP, respuestaSap.status, respuestaSap.statusText, respuestaSap.data);
			}

		} catch (errorComunicacion) {
			this.#log.err('La llamada SAP no se ha podido realizar por un error en la comunicación', errorComunicacion);
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
		if (this.#devuelveEnCrudo) return respuestaSap;
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