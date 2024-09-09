'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;


// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const CRC = require('modelos/CRC');
const LineaLogisticaCliente = require('./ModeloLineaLogisticaCliente');
const DireccionLogistica = require('./ModeloDireccionLogistica');

// Helpers
const Validador = require('global/validador');


class LogisticaCliente {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		this.txId = txId;
		this.metadatos = {
			todasLineasInvalidas: true
		}

		// Comprobamos los campos mínimos que deben aparecer en la CABECERA de un pedido de logística
		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'LOG-ERR-000', 'El campo "codigoCliente" es obligatorio');
		Validador.esCadenaNoVacia(json.numeroLogisticaOrigen, errorFedicom, 'LOG-ERR-000', 'El campo "numeroLogisticaOrigen" es obligatorio')
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'LOG-ERR-000', 'El campo "lineas" no puede estar vacío');
		
		let tipoLogisticaSaneado;
		if (Validador.esCadenaNoVacia(json.tipoLogistica, errorFedicom, 'LOG-ERR-000', 'El campo "tipoLogistica" es obligatorio')) {
			tipoLogisticaSaneado = json.tipoLogistica.toString().trim().toUpperCase();

			let descripcionTipoLogistica =  C.logistica.tiposAdmitidos[tipoLogisticaSaneado];
			if (!descripcionTipoLogistica) {
				L.xe(txId, ['El campo "tipoLogistica" no tiene un valor válido', json.tipoLogistica]);
				errorFedicom.insertar('LOG-ERR-000', 'El campo "tipoLogistica" no tiene un valor válido');
			}
		}


		let direccionOrigen = new DireccionLogistica(txId, json.origen);
		if (direccionOrigen.esErronea()) {
			direccionOrigen.getErrores().forEach((err) => errorFedicom.insertar(err));
		}

		let direccionDestino = new DireccionLogistica(txId, json.destino);
		if (direccionDestino.esErronea()) {
			direccionDestino.getErrores().forEach((err) => errorFedicom.insertar(err));
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias y se lanza una excepción.
		if (errorFedicom.tieneErrores()) {
			L.xe(txId, 'La solicitud logística contiene errores. Se aborta el procesamiento de la misma');
			throw errorFedicom;
		}
		

		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.codigoCliente = json.codigoCliente.trim();
		this.numeroLogisticaOrigen = json.numeroLogisticaOrigen.trim();

		this.origen = direccionOrigen;
		this.destino = direccionDestino;


		// tipoLogistica
		if (Validador.esCadenaNoVacia(json.tipoLogistica)) {
			this.tipoLogistica = json.tipoLogistica.trim();
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

		// fechaRecogidaSolicitada
		if (Validador.esFechaHora(json.fechaRecogidaSolicitada)) {
			this.fechaRecogidaSolicitada = json.fechaRecogidaSolicitada.trim();
		}


		// Copiamos las líneas, no sin antes analizarlas.
		this.#analizarPosiciones(req);


		// Incluimos en el pedido de logística los valores del usuario que lo transmitió
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

	
		// Generación del CRC del pedido de logística
		this.crc = CRC.generar(this.codigoCliente, this.numeroLogisticaOrigen);
	}

	/**
	* Analiza las posiciones de pedido de la petición HTTP.
	* Asume que req.body.lineas es un array.
	* @param {*} req
	*/
	#analizarPosiciones(req) {
		let txId = req.txId;
		let lineas = req.body.lineas || [];
		this.lineas = [];
		let ordenes = [];

		lineas.forEach((linea, i) => {
			let lineaLogistica = new LineaLogisticaCliente(linea, txId, i);
			this.lineas.push(lineaLogistica);

			// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
			if (lineaLogistica.orden) {
				ordenes.push(parseInt(lineaLogistica.orden));
			}

			if (lineaLogistica.esLineaCorrecta()) {
				this.metadatos.todasLineasInvalidas = false;
			}

		});

		// Rellenamos el orden.
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

	contienteLineasValidas() {
		return !this.metadatos.ignorarTodasLineas;
	}

	/**
	 * Genera un objeto JSON con la respuesta a esta petición de devolución, indicando únicamente en la
	 * respuesta las líneas excluidas por contener errores. Este método es útil para darle una respuesta
	 * al cliente cuando la transmisión no contiene ninguna línea apta para mandar a SAP.
	 */
	generarRespuestaDeTodasLasLineasSonInvalidas() {

		let errorFedicom = {
			codigo: K.INCIDENCIA_FEDICOM.ERR_LOG,
			descripcion: 'Existen errores en todas las líneas, el pedido de logística no se procesa.'
		};

		let respuesta = {
			codigoCliente: this.codigoCliente,
			numeroLogisticaOrigen: this.numeroLogisticaOrigen,
			tipoLogistica: this.tipoLogistica,
			origen: this.origen.generarJSON(),
			destino: this.destino.generarJSON(),
			lineas: this.lineas.map(l => l.generarJSON(false)),
			incidencias: [errorFedicom]
		}

		if (this.observaciones) respuesta.observaciones = this.observaciones;
		if (this.incidencias) respuesta.incidencias.concat(this.incidencias);

		return respuesta;
	}

	generarJSON(generarParaSap = true) {
		let respuesta = {}

		respuesta.codigoCliente = this.codigoCliente;
		respuesta.numeroLogisticaOrigen = this.numeroLogisticaOrigen;
		respuesta.tipoLogistica = this.tipoLogistica;
		
		respuesta.origen = this.origen.generarJSON(generarParaSap);
		respuesta.destino = this.destino.generarJSON(generarParaSap);

		if (this.fechaRecogidaSolicitada) respuesta.fechaRecogidaSolicitada = this.fechaRecogidaSolicitada;
		if (this.observaciones) respuesta.observaciones = this.observaciones;
		
		respuesta.lineas = this.lineas.map(l => l.generarJSON(generarParaSap));

		if (generarParaSap) {
			respuesta.crc = this.crc;
			respuesta.login = this.login;
			
		}

		return respuesta;
	}

}


module.exports = LogisticaCliente;
