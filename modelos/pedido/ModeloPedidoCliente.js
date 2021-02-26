'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const HOSTNAME = require('os').hostname();

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const LineaPedidoCliente = require('./ModeloLineaPedidoCliente');
const CRC = require('modelos/CRC');

// Helpers
const Validador = require('util/validador');

/** 
 * Objeto que representa la petición de creación de un pedido por parte del cliente
 */
class PedidoCliente {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		this.txId = txId;

		// Comprobamos los campos mínimos que deben aparecer en la CABECERA de un pedido
		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		Validador.esCadenaNoVacia(json.numeroPedidoOrigen, errorFedicom, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
		
		if (json.codigoCliente && json.codigoCliente.endsWith('@hefame')) {
			errorFedicom.insertar('PED-ERR-002', 'Indique el "codigoCliente" sin el @hefame al final', 400);
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias y se lanza una excepción.
		if (errorFedicom.tieneErrores()) {
			L.xe(txId, ['El pedido contiene errores. Se aborta el procesamiento del mismo', errorFedicom]);
			throw errorFedicom;
		}


		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.codigoCliente = json.codigoCliente.trim();
		this.numeroPedidoOrigen = json.numeroPedidoOrigen.trim();

		// Valores que no han sido comprobados previamente:
		// notificaciones: [{tipo: string, valor: string}]
		if (Validador.esArrayNoVacio(json.notificaciones)) {
			this.notificaciones = json.notificaciones.filter(n => {
				if (Validador.esCadenaNoVacia(n.tipo) && Validador.esCadenaNoVacia(n.valor))
					return true;
				L.xw(txId, ['Se descarta una notificación por no ser correcta', n])
				return false;
			}).map(n => { return { tipo: n.tipo, valor: n.valor } })
		}

		// direccionEnvio
		if (Validador.esCadenaNoVacia(json.direccionEnvio)) {
			this.direccionEnvio = json.direccionEnvio.trim();
		}

		// codigoAlmacenServicio
		if (Validador.esCadenaNoVacia(json.codigoAlmacenServicio)) {
			this.codigoAlmacenServicio = json.codigoAlmacenServicio.trim();
			this.#converAlmacen();
		}

		// tipoPedido
		if (Validador.esCadenaNoVacia(json.tipoPedido)) {
			this.tipoPedido = json.tipoPedido.trim();
		}

		// fechaServicio
		if (Validador.existe(json.fechaServicio)) {
			if (Validador.esFechaHora(json.fechaServicio)) {
				this.fechaServicio = json.fechaServicio.trim();
			} else {
				L.xw(txId, 'El campo "fechaServicio" no va en formato Fedicom3 DateTime dd/mm/yyyy hh:mm:ss');
			}
		}

		// aplazamiento
		if (Validador.existe(json.aplazamiento)) {
			if (Validador.esEnteroPositivoMayorQueCero(json.aplazamiento)) {
				this.aplazamiento = parseInt(json.aplazamiento);
			} else {
				L.xw(txId, ['El campo "aplazamiento" no es un entero > 0', json.aplazamiento]);
			}
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}



		// Copiamos las líneas, no sin antes analizarlas.
		let [lineasSaneadas, errorEnTodasLineas, crcLineas] = PedidoCliente.#analizarPosiciones(req);
		this.lineas = lineasSaneadas;
		this.errorEnTodasLineas = errorEnTodasLineas;


		// Incluimos en el pedido los valores del usuario que lo transmitió
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		if (Validador.esCadenaNoVacia(json.sapSystem)) {
			this.sapSystem = json.sapSystem.trim();
		}


		// Limpieza del código del cliente.
		// Si tiene mas de 10 dígitos lo truncamos a 10, ya que SAP da error 500 (Imposibol, SAP no falla nunca!)
		if (this.codigoCliente.length > 10) {
			let codigoClienteNuevo = this.codigoCliente.substring(this.codigoCliente.length - 10);
			L.xw(txId, ['Se trunca el codigo de cliente a 10 dígitos para que SAP no explote', this.codigoCliente, codigoClienteNuevo]);
			this.codigoCliente = codigoClienteNuevo;
		}


		// 15.02.2021 - Para pedidos de mas de 10 líneas, vamos a generar el CRC en función de las propias
		// líneas y no del numeroPedidoOrigen.
		if (this.lineas.length > 10) {
			this.crc = CRC.generar(this.codigoCliente, crcLineas);
			this.crcDeLineas = true;
			L.xd(txId, ['Se asigna el siguiente CRC para el pedido usando las lineas del mismo', this.crc], 'txCRC')
		} else {
			this.crc = CRC.generar(this.codigoCliente, this.numeroPedidoOrigen);
			this.crcDeLineas = false;
			L.xd(txId, ['Se asigna el siguiente CRC para el pedido usando el numeroPedidoOrigen', this.crc], 'txCRC')
		}


	}


	/**
	* Analiza las posiciones de pedido de la petición HTTP.
	* Asume que req.body.lineas es un array.
	* @param {*} req
	*/
	static #analizarPosiciones(req) {
		let txId = req.txId;
		let lineas = req.body.lineas || [];
		let lineasSaneadas = [];
		let ordenes = [];

		let todasLineasInvalidas = true;
		let crcLineas = '';

		lineas.forEach((linea, i) => {
			let lineaPedido = new LineaPedidoCliente(linea, txId, i);

			// "Acumulamos" el CRC de la linea
			crcLineas = CRC.generar(crcLineas, lineaPedido.crc);

			lineasSaneadas.push(lineaPedido);

			// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
			if (lineaPedido.orden) {
				ordenes.push(parseInt(lineaPedido.orden));
			}

			if (lineaPedido.esLineaCorrecta()) {
				todasLineasInvalidas = false;
			}


		});

		// Rellenamos el orden.
		let siguienteOrdinal = 1;
		lineasSaneadas.forEach((linea) => {
			if (!linea.orden) {
				while (ordenes.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.orden = siguienteOrdinal;
				siguienteOrdinal++;
			}
		});
		return [lineasSaneadas, todasLineasInvalidas, crcLineas];

	}

	#generaUrlConfirmacion() {
		return 'http://' + HOSTNAME + '.hefame.es:' + C.http.port + '/confirmaPedido';
	}

	/**
	 * Convierte los códigos de almacén obsoletos en los nuevos códigos. Por ejemplo, el código "02"
	 * era Santomera. Este conver se ha sacado del codigo fuente de Fedicom v2.
	 */
	#converAlmacen() {

		if (!this.codigoAlmacenServicio.startsWith('RG')) {
			let codigoFedicom2 = parseInt(this.codigoAlmacenServicio);
			switch (codigoFedicom2) {
				case 2: this.codigoAlmacenServicio = 'RG01'; break;  // Santomera
				case 5: this.codigoAlmacenServicio = 'RG15'; break; // Barcelona viejo
				case 9: this.codigoAlmacenServicio = 'RG19'; break; // Málaga viejo
				case 13: this.codigoAlmacenServicio = 'RG04'; break; // Madrid viejo
				case 3: /* Cartagena */
				case 4: /* Madrid nuevo */
				case 6: /* Alicante */
				case 7: /* Almería */
				case 8: /* Albacete */
				case 10: /* Valencia */
				case 15: /* Barcelona */
				case 16: /* Tortosa */
				case 17: /* Melilla */
				case 18: /* Granada */
				case 19: /* Malaga nuevo */
					this.codigoAlmacenServicio = 'RG' + (codigoFedicom2 > 9 ? codigoFedicom2 : '0' + codigoFedicom2);
					break;
				default:
					delete this.codigoAlmacenServicio;
					this.addIncidencia(K.CODIGOS_ERROR_FEDICOM.WARN_NO_EXISTE_ALMACEN, 'No se reconoce el código de almacén indicado – Se le asigna su almacén habitual');
			}
		}

	}

	/**
	 * Indica si al menos existe una línea en el pedido que pueda mandarse a SAP
	 */
	contieneLineasValidas() {
		return !this.errorEnTodasLineas;
	}

	/**
	 * Genera un objeto JSON con la respuesta a esta petición de devolución, indicando únicamente en la
	 * respuesta las líneas excluidas por contener errores. Este método es útil para darle una respuesta
	 * al cliente cuando la transmisión no contiene ninguna línea apta para mandar a SAP.
	 */
	generarRespuestaDeTodasLasLineasSonInvalidas() {

		let errorFedicom = {
			codigo: K.CODIGOS_ERROR_FEDICOM.ERR_TODAS_LINEAS_ERROR,
			descripcion: 'Existen errores en todas las líneas, el pedido no se procesa.'
		};

		let respuesta = {
			codigoCliente: this.codigoCliente,
			numeroPedidoOrigen: this.numeroPedidoOrigen,
			lineas: this.lineas.map(l => l.generarJSON(false)),
			incidencias: [errorFedicom]
		}
		if (this.notificaciones) respuesta.notificaciones = this.notificaciones;
		if (this.direccionEnvio) respuesta.direccionEnvio = this.direccionEnvio;
		if (this.codigoAlmacenServicio) respuesta.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.tipoPedido) respuesta.tipoPedido = this.tipoPedido;
		if (this.fechaServicio) respuesta.fechaServicio = this.fechaServicio;
		if (this.aplazamiento) respuesta.aplazamiento = this.aplazamiento;
		if (this.observaciones) respuesta.observaciones = this.observaciones;
		if (this.incidencias) respuesta.incidencias.concat(this.incidencias);

		return respuesta;
	}

	gererarRespuestaFaltasSimuladas() {

		let errorFedicom = {
			codigo: 'PED-WARN-001',
			descripcion: 'Pedido recibido pero pendiente de tramitar - Consulte o reintente más tarde para obtener toda la información'
		};

		let respuesta = {
			codigoCliente: this.codigoCliente,
			numeroPedidoOrigen: this.codigoCliente,
			lineas: this.lineas.map(l => l.generarJSON(false)),
			incidencias: [errorFedicom],
			fechaPedido: Date.toFedicomDateTime(),
			numeroPedido: this.crc
		}
		if (this.notificaciones) respuesta.notificaciones = this.notificaciones;
		if (this.direccionEnvio) respuesta.direccionEnvio = this.direccionEnvio;
		if (this.codigoAlmacenServicio) respuesta.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.tipoPedido) respuesta.tipoPedido = this.tipoPedido;
		if (this.fechaServicio) respuesta.fechaServicio = this.fechaServicio;
		if (this.aplazamiento) respuesta.aplazamiento = this.aplazamiento;
		if (this.observaciones) respuesta.observaciones = this.observaciones;
		if (this.incidencias) respuesta.incidencias.concat(this.incidencias);

		return respuesta;
	}

	generarJSON(generarParaSap = true) {
		let respuesta = {}

		respuesta.codigoCliente = this.codigoCliente;
		if (this.notificaciones) respuesta.notificaciones = this.notificaciones;
		if (this.direccionEnvio) respuesta.direccionEnvio = this.direccionEnvio;
		if (this.codigoAlmacenServicio) respuesta.codigoAlmacenServicio = this.codigoAlmacenServicio;
		respuesta.numeroPedidoOrigen = this.numeroPedidoOrigen;
		if (this.tipoPedido) respuesta.tipoPedido = this.tipoPedido;
		if (this.fechaServicio) respuesta.fechaServicio = this.fechaServicio;
		if (this.aplazamiento) respuesta.aplazamiento = this.aplazamiento;
		if (this.observaciones) respuesta.observaciones = this.observaciones;
		respuesta.lineas = this.lineas.map(l => l.generarJSON(generarParaSap));
		if (this.incidencias) respuesta.incidencias = this.incidencias;

		if (generarParaSap) {
			respuesta.sap_url_confirmacion = this.#generaUrlConfirmacion();
			respuesta.crc = this.crc;
			respuesta.login = this.login;
			if (this.sapSystem) respuesta.sapSystem = this.sapSystem;
		}

		return respuesta;
	}

	/**
	 * Regenera el CRC del pedido.
	 * Este CRC siempre se genera utilizando el numeroPedidoOrigen y nunca las líneas.
	 */
	regenerarCrc() {
		this.crc = CRC.generar(this.codigoCliente, this.numeroPedidoOrigen);
		this.crcDeLineas = false;
		L.xd(this.txId, ['Se regenera el CRC para el pedido usando el numeroPedidoOrigen', this.crc], 'txCRC')
	}


	/**
	 * Añade una incidencia a la cabecera del pedido.
	 * Se puede indicar el (codigo, descripcion) del error, o pasar un único parametro con un objeto instancia de ErrorFedicom
	 * @param {*} code 
	 * @param {*} descripcion 
	 */
	addIncidencia(code, descripcion) {
		let incidencia = (code instanceof ErrorFedicom) ? code : new ErrorFedicom(code, descripcion);

		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push(incidencia.getErrores()[0])
		} else {
			this.incidencias = incidencia.getErrores();
		}
	}

}




module.exports = PedidoCliente;
