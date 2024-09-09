'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const HOSTNAME = require('os').hostname();
const { v4: uuidv4 } = require('uuid');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const LineaPedidoCliente = require('./ModeloLineaPedidoCliente');
const CRC = require('modelos/CRC');

// Helpers
const Validador = require('global/validador');
const MAESTRO = require('global/maestro');

/** 
 * Objeto que representa la petición de creación de un pedido por parte del cliente
 */
class PedidoCliente {

	constructor(req, opciones = {}) {

		let txId = req.txId;
		let json = req.body;

		let { fechaRecepcion } = opciones; 

		this.txId = txId;
		this.metadatos = {
			todasLineasInvalidas: true,
			crcDeLineas: false,
			crcLineas: '',
			fechaRecepcion: fechaRecepcion || new Date()
		}

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
			L.xw(txId, ['El pedido contiene errores. Se aborta el procesamiento del mismo', errorFedicom]);
			throw errorFedicom;
		}




		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.codigoCliente = json.codigoCliente.trim();
		this.numeroPedidoOrigen = json.numeroPedidoOrigen.trim();

		// Chequeo del cliente en la lista negra
		if (MAESTRO.listaNegra.clientes.includes(this.codigoCliente)) {
			L.xw(txId, ['El cliente se encuentra en la lista negra, se aplicarán chequeos de duplicidad adicionales']);
			this.metadatos.clienteListaNegra = true;
		}


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
		this.#analizarPosiciones(req);


		// Incluimos en el pedido los valores del usuario que lo transmitió
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}


		// Limpieza del código del cliente.
		// Si tiene mas de 10 dígitos lo truncamos a 10, ya que SAP da error 500 (Imposibol, SAP no falla nunca!)
		if (this.codigoCliente.length > 10) {
			let codigoClienteNuevo = this.codigoCliente.substring(this.codigoCliente.length - 10);
			L.xw(txId, ['Se trunca el codigo de cliente a 10 dígitos para que SAP no explote', this.codigoCliente, codigoClienteNuevo]);
			this.codigoCliente = codigoClienteNuevo;
		}


		// 15.02.2021 - Para pedidos de mas de (C.pedidos.umbralLineasCrc) líneas, vamos a generar el CRC en función de las propias
		// líneas y no del numeroPedidoOrigen.
		// 19.04.2021 - Se incluye el código de almacén de servicio 
		if (this.lineas.length > C.pedidos.umbralLineasCrc || this.metadatos.clienteListaNegra === true) {
			this.crc = CRC.generar(this.codigoCliente, this.metadatos.crcLineas, this.codigoAlmacenServicio, this.tipoPedido);
			this.metadatos.crcDeLineas = true;
			L.xd(txId, ['Se asigna el siguiente CRC para el pedido usando las lineas del mismo', this.crc], 'txCRC')
		} else {
			this.crc = CRC.generar(this.codigoCliente, this.numeroPedidoOrigen, this.tipoPedido);
			this.metadatos.crcDeLineas = false;
			L.xd(txId, ['Se asigna el siguiente CRC para el pedido usando el numeroPedidoOrigen', this.crc], 'txCRC')
		}

		// Nombre del consumidor final (F+Online especifico)
		if (Validador.esCadenaNoVacia(json.nombreConsumidorFinal)) {
			this.nombreConsumidorFinal = json.nombreConsumidorFinal.trim().substring(0, 128);
		}

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

		lineas.sort((a, b) => a.codigoArticulo < b.codigoArticulo ? -1 : 1);

		lineas.forEach((linea, i) => {
			let lineaPedido = new LineaPedidoCliente(linea, txId, i);

			// "Acumulamos" el CRC de la linea
			this.metadatos.crcLineas = CRC.generar(this.metadatos.crcLineas, lineaPedido.crc);

			this.lineas.push(lineaPedido);

			// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
			if (lineaPedido.orden) {
				ordenes.push(parseInt(lineaPedido.orden));
			}

			if (lineaPedido.esLineaCorrecta()) {
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

	#generaUrlConfirmacion() {
		return 'http://' + HOSTNAME + '.hefame.es:' + C.http.puertoConcentrador + '/confirmaPedido';
	}

	/**
	 * Convierte los códigos de almacén obsoletos en los nuevos códigos. Por ejemplo, el código "02"
	 * era Santomera. Este conver se ha sacado del codigo fuente de Fedicom v2.
	 */
	#converAlmacen() {

		if (this.codigoAlmacenServicio === 'RG10' || this.codigoAlmacenServicio === 'RG02') {
			L.xw(this.txId, ['Los almacenes RG10 y RG02 ya no se pueden forzar - Se elimina el campo']);
			delete this.codigoAlmacenServicio;
			this.addIncidencia(K.INCIDENCIA_FEDICOM.WARN_PED, 'Los almacenes RG10 y RG02 no se admiten - Se le asigna su almacén habitual');
			return;
		}

		if (!this.codigoAlmacenServicio.startsWith('RG')) {

			const cambiarAlmacen = (nuevoAlmacen) => {
				if (nuevoAlmacen) {
					L.xw(this.txId, ['Se traduce el código del almacén.', this.codigoAlmacenServicio, nuevoAlmacen])
					this.codigoAlmacenServicio = nuevoAlmacen;
				} else {
					L.xw(this.txId, ['No se reconce el código de almacén indicado - Se elimina el campo para que SAP lo elija']);
					delete this.codigoAlmacenServicio;
					this.addIncidencia(K.INCIDENCIA_FEDICOM.WARN_PED, 'No se reconoce el código de almacén indicado - Se le asigna su almacén habitual');
				}
			}

			let codigoFedicom2 = parseInt(this.codigoAlmacenServicio);
			switch (codigoFedicom2) {
				case 2: cambiarAlmacen('RG01'); break;  // Santomera
				case 5: cambiarAlmacen('RG15'); break; // Barcelona viejo
				case 9: cambiarAlmacen('RG19'); break; // Málaga viejo
				case 13: cambiarAlmacen('RG04'); break; // Madrid viejo
				case 10: cambiarAlmacen('RG11'); break; // Valencia viejo pasa a Ribarroja
				case 3: /* Cartagena */
				case 4: /* Madrid nuevo */
				case 6: /* Alicante */
				case 7: /* Almería */
				case 8: /* Albacete */
				case 11: /* Ribarroja */
				case 15: /* Barcelona */
				case 16: /* Tortosa */
				case 17: /* Melilla */
				case 18: /* Granada */
				case 19: /* Malaga nuevo */
					cambiarAlmacen('RG' + (codigoFedicom2 > 9 ? codigoFedicom2 : '0' + codigoFedicom2));
					break;
				default:
					cambiarAlmacen(null);
			}
		}

	}

	/**
	 * Indica si al menos existe una línea en el pedido que pueda mandarse a SAP
	 */
	contieneLineasValidas() {
		return !this.metadatos.todasLineasInvalidas;
	}

	/**
	 * Genera un objeto JSON con la respuesta a esta petición de devolución, indicando únicamente en la
	 * respuesta las líneas excluidas por contener errores. Este método es útil para darle una respuesta
	 * al cliente cuando la transmisión no contiene ninguna línea apta para mandar a SAP.
	 */
	generarRespuestaDeTodasLasLineasSonInvalidas() {

		let errorFedicom = {
			codigo: K.INCIDENCIA_FEDICOM.ERR_PED,
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
			//descripcion: 'Pedido recibido pero pendiente de tramitar - Consulte o reintente más tarde para obtener toda la información'
			descripcion: 'Su pedido se ha recibido correctamente, pero no hemos podido informar las faltas.'
		};

		let respuesta = {
			codigoCliente: this.codigoCliente,
			numeroPedidoOrigen: this.numeroPedidoOrigen,
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


			L.xt(this.txId, ['Fecha de recepción indicada.', this.metadatos.fechaRecepcion])
			if (!this.metadatos.fechaRecepcion.toSapDate) {
				this.metadatos.fechaRecepcion = new Date(this.metadatos.fechaRecepcion);
			}

			respuesta.fecha_recepcion = Date.toSapDate(this.metadatos.fechaRecepcion);
			respuesta.hora_recepcion = Date.toSapTime(this.metadatos.fechaRecepcion);
		}

		return respuesta;
	}

	/**
	 * Regenera el CRC del pedido.
	 * Este CRC siempre se genera utilizando el numeroPedidoOrigen y nunca las líneas.
	 */
	inventarCRC() {
		this.numeroPedidoOrigen = uuidv4();
		this.crc = CRC.generar(this.codigoCliente, this.numeroPedidoOrigen);
		this.crcDeLineas = false;
		L.xd(this.txId, ['Se inventan el CRC y el numeroPedidoOrigenpara', this.crc, this.numeroPedidoOrigen], 'txCRC')
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
