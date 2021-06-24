'use strict';
const ErrorFedicom = require('modelos/ErrorFedicom');
const Validador = require('global/validador');
const Modelo = require('modelos/transmision/Modelo');
const LineaDevolucionCliente = require('./LineaDevolucionCliente');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class SolicitudCrearDevolucion extends Modelo {

	metadatos = {							// Metadatos
		errores: new ErrorFedicom(),		// Errores encontrados al instanciar la solicitud
		errorProtocoloCabecera: false,		// Indica si la transmisión no tiene la cabecera según el protocolo
		errorProtocoloTodasLineas: true,	// Indica si la transmisión no contiene ninguna línea válida según el protocolo
		contieneLineasErroneas: false		// Indica si existen lineas con errores de protocolo en el campo "lineas"
	};

	// Campos de entrada SANEADOS
	codigoCliente;
	observaciones;
	lineas;

	// @Override
	constructor(transmision) {
		super(transmision);
		let json = transmision.req.body;

		// Comprobamos los campos mínimos que deben aparecer en la CABECERA de una devolucion
		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'DEV-ERR-002', 'El campo "codigoCliente" es obligatorio');
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'DEV-ERR-003', 'El campo "lineas" no puede estar vacío');

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias y se lanza una excepción.
		if (errorFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en la cabecera del mensaje', errorFedicom);
			this.metadatos.errorProtocoloCabecera = true;
			this.metadatos.errores = errorFedicom;
			return;
		}

		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.codigoCliente = json.codigoCliente.trim();

		// Valores opcionales que deben comprobarse:
		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

		// Análisis de las líneas
		this.#analizarPosiciones(json.lineas);

		// Para evitar duplicados, vamos a generar el CRC con el ID de transmisión
		this.metadatos.crc = this.transmision.txId;

	}


	/**
	 * Analiza las posiciones de devolución de la petición HTTP.
	 * Asume que req.body.lineas es un array.
	 * @param {*} req 
	 */
	#analizarPosiciones(lineas) {

		// Aquí guardaremos los valores del campo "orden" que veamos en las líneas.
		// Lo necesitamos para no repetir valores.
		let ordinales = [];
		this.lineas = [];

		lineas.forEach((linea, numeroPosicion) => {
			let lineaDevolucionCliente = new LineaDevolucionCliente(this, linea, numeroPosicion);

			this.lineas.push(lineaDevolucionCliente);


			// Si aparece alguna línea buena, habrá cosas que mandar a SAP
			if (!lineaDevolucionCliente.tieneErrores()) {
				this.metadatos.errorProtocoloTodasLineas = false;
			} else {
				this.metadatos.contieneLineasErroneas = true;
			}

			// Guardamos el orden de aquellas lineas para llevar la cuenta de los ordenes que se han usado.
			if (lineaDevolucionCliente.orden) {
				ordinales.push(lineaDevolucionCliente.orden);
			}
		});

		// Rellenamos el orden en las lineas buenas donde no viene con enteros que no estén usados en otras líneas
		let siguienteOrdinal = 1;
		this.lineas.forEach((linea) => {
			if (!linea.orden) {
				// Encontramos el siguiente entero que no esté en uso actualmente
				while (ordinales.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.orden = siguienteOrdinal;
				siguienteOrdinal++;
			}
		});

	}



	/**
	 * Genera un JSON con los dataos de la transmisión listo para ser enviado vía HTTP.
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'errores': Se envía el array de errores Fedicom o el pedido sin las faltas
	 */
	generarJSON(tipoReceptor = 'sap') {

		if (this.metadatos.errorProtocoloCabecera) {
			return this.metadatos.errores.getErrores() || [];
		}

		let json = {
			codigoCliente: this.codigoCliente,
			numeroPedidoOrigen: this.numeroPedidoOrigen,
		}

		if (tipoReceptor === 'sap') {
			json.login = this.transmision.token.getDatosLoginSap();
			json.crc = this.metadatos.crc;
			json.lineas = this.lineas
				.filter(l => !l.tieneErrores())
				.map(l => l.generarJSON(tipoReceptor))
		} else {
			json.lineas = this.lineas.map(l => l.generarJSON(tipoReceptor))
		}

		return json;
	}

	getLineasErroneas() {
		return this.lineas.filter(l => l.tieneErrores())
	}

	contieneErroresProtocolo() {
		return this.metadatos.errorProtocoloCabecera || this.metadatos.errorProtocoloTodasLineas;
	}


}


module.exports = SolicitudCrearDevolucion;