'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const LineaDevolucionCliente = require('./ModeloLineaDevolucionCliente');
const CRC = require('modelos/CRC');

// Helpers
const Validador = require('global/validador');



/**
 * Esta clase representa un objeto de devolución recibido de un cliente.
 */
class DevolucionCliente {

	/**
	 * Construye el objeto de la petición de devolución a partir de la peticion HTTP del cliente.
	 */
	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		this.txId = txId;
		L.xt(txId, ['Instanciando objeto Devolucion Cliente con los datos del cuerpo HTTP', json]);

		// Comprobamos los campos mínimos que deben aparecer en la CABECERA de una devolucion
		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'DEV-ERR-002', 'El campo "codigoCliente" es obligatorio');
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'DEV-ERR-003', 'El campo "lineas" no puede estar vacío');

		// 30/03/2023 - Evitamos que clientes Aliance-Health hagan devoluciones
		this.codigoCliente = json.codigoCliente.trim();
		if (this.codigoCliente.match(/^(((00)?101)?4)[0-9]{4}/)) {
			L.xe(txId, 'La devolución es de un cliente Aliance. No se admite.');
			errorFedicom.insertar('DEV-ERR-999', 'Servicio de devoluciones no disponible', 418)
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias y se lanza una excepción.
		if (errorFedicom.tieneErrores()) {
			L.xe(txId, 'La devolución contiene errores. Se aborta el procesamiento de la misma');
			throw errorFedicom;
		}



		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.codigoCliente = json.codigoCliente.trim();




		// Valores opcionales que deben comprobarse:
		// observaciones
		if (Validador.esCadenaNoVacia(this.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}



		// Copiamos las líneas, no sin antes analizarlas.
		let [lineasSaneadas, lineasExcluidas, crcLineas] = DevolucionCliente.#analizarPosiciones(req);
		this.lineas = lineasSaneadas;
		this.lineasExcluidas = lineasExcluidas;


		// Incluimos en la devolución los valores del usuario que la transmitió
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}


		// 20.10.2020 - Para evitar duplicados, vamos a generar el CRC siempre con el timestamp actual
		this.crc = CRC.generar(this.codigoCliente, crcLineas, Date.fedicomTimestamp());

	}

	/**
	 * TODO: Este método es de instancia no de clase.
	 * Analiza las posiciones de devolución de la petición HTTP.
	 * Asume que req.body.lineas es un array.
	 * @param {*} req 
	 */
	static #analizarPosiciones(req) {
		let txId = req.txId;
		let lineas = req.body.lineas || [];

		let lineasBuenas = [];
		let lineasMalas = [];
		let crcLineas = '';
		// Aquí guardaremos los valores del campo "orden" que veamos en las líneas.
		// Lo necesitamos para no repetir valores.
		let ordenes = [];

		lineas.forEach((linea, i) => {
			let lineaDevolucionCliente = new LineaDevolucionCliente(linea, txId, i);

			// "Acumulamos" el CRC de la linea
			crcLineas = CRC.generar(crcLineas, lineaDevolucionCliente.crc);

			// Separamos las líneas buenas de las malas.
			if (lineaDevolucionCliente.excluir) {
				lineasMalas.push(lineaDevolucionCliente);
			} else {
				lineasBuenas.push(lineaDevolucionCliente);
			}

			// Guardamos el orden de aquellas lineas para llevar la cuenta de los 
			// ordenes que se han usado.
			if (lineaDevolucionCliente.orden) {
				ordenes.push(lineaDevolucionCliente.orden);
			}
		});

		// Rellenamos el orden en las lineas buenas donde no viene con enteros que no estén usados en otras líneas
		let siguienteOrdinal = 1;
		lineasBuenas.forEach((linea) => {
			if (!linea.orden) {
				// Encontramos el siguiente entero que no esté en uso actualmente
				while (ordenes.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.orden = siguienteOrdinal;
				siguienteOrdinal++;
			}
		});

		return [lineasBuenas, lineasMalas, crcLineas];
	}

	/**
	 * Indica si la devolución contiene al menos una línea valida para ser pasada a SAP
	 */
	contieneLineasValidas() {
		return this.lineas.length > 0;
	}

	/**
	 * 
	 */
	contieneLineasExcluidas() {
		return this.lineasExcluidas.length > 0;
	}

	/**
	 * Genera un array con las lineas excluidas en formato apto para el cliente
	 */
	generarListaLineasExcluidas() {
		return this.lineasExcluidas.map(linea => linea.generarJSON());
	}

	/**
	 * Genera un objeto JSON con la respuesta a esta petición de devolución, indicando únicamente en la
	 * respuesta las líneas excluidas por contener errores. Este método es útil para darle una respuesta
	 * al cliente cuando la transmisión no contiene ninguna línea apta para mandar a SAP.
	 */
	generarRespuestaDeTodasLasLineasSonInvalidas() {
		let respuesta = {
			codigoCliente: this.codigoCliente,
			lineas: this.generarListaLineasExcluidas()
		}
		if (this.observaciones) respuesta.observaciones = this.observaciones;
		return respuesta;
	}

	generarJSON() {
		let json = {
			codigoCliente: this.codigoCliente,
			lineas: this.lineas.map(linea => linea.generarJSON())
		}
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.login) json.login = this.login;
		if (this.crc) json.crc = this.crc;

		return json;
	}

}


module.exports = DevolucionCliente;
