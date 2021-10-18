'use strict';
const C = global.C;
const K = global.K;
const M = global.M;
const ErrorFedicom = require('modelos/ErrorFedicom');
const Crc = require('global/crc');
const Validador = require('global/validador');
const LineaPedidoCliente = require('modelos/pedido/LineaPedidoCliente');
const Modelo = require('modelos/transmision/Modelo');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class SolicitudCrearPedido extends Modelo {

	metadatos = {							// Metadatos
		errores: new ErrorFedicom(),		// Errores encontrados al instanciar la solicitud
		errorProtocoloCabecera: false,		// Indica si la transmisión no tiene la cabecera según el protocolo
		todasLineasInvalidas: true,			// Indica si la transmisión no contiene ninguna línea válida según el protocolo
		crc: '',							// El CRC de la solicitud
		crcAcumuladoLineas: '',				// Acumulador del CRC de líneas
		tipoCrc: 'numeroPedidoOrigen',		// Indica el metodo de generación del CRC (numeroPedidoOrigen | lineas)
		codigoAlmacenDesconocido: false,	// Indica si se ha encontrado un código de almacén desconocido.
		codigoAlmacenSaneado: false,		// Indica si se ha modificado el código de almacén indicado por el usuario.
		esDuplicado: false,					// Indica si el pedido es un duplicado de otro.
		esRetransmisionCliente: false,		// Indica si el pedido es un duplicado de otro que acabó en mal estado.
		errorComprobacionDuplicado: false,	// Indica si hubo un error al comprobar si el pedido es duplicado.
	};

	// Campos de entrada SANEADOS
	codigoCliente;
	numeroPedidoOrigen;
	notificaciones;
	direccionEnvio;
	codigoAlmacenServicio;
	tipoPedido;
	fechaServicio;
	aplazamiento;
	observaciones;
	lineas;

	// @Override
	constructor(transmision) {
		super(transmision);
		let json = transmision.req.body;

		this.log.info('Analizando la solicitud de crear pedido')

		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		Validador.esCadenaNoVacia(json.numeroPedidoOrigen, errorFedicom, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');

		if (json.codigoCliente?.endsWith?.('@hefame')) {
			errorFedicom.insertar('PED-ERR-002', 'Indique el "codigoCliente" sin el @hefame al final', 400);
		}

		if (errorFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en la cabecera del mensaje', errorFedicom);
			this.metadatos.errorProtocoloCabecera = true;
			this.metadatos.errores.insertar(errorFedicom);
			return;
		}


		// codigoCliente
		this.codigoCliente = json.codigoCliente.trim();
		// Limpieza del código del cliente.
		// Si tiene mas de 10 dígitos lo truncamos a 10, ya que SAP da error 500 (Imposibol, SAP no falla nunca!)
		if (this.codigoCliente.length > 10) {
			let codigoClienteNuevo = this.codigoCliente.substring(this.codigoCliente.length - 10);
			this.log.warn(`Se trunca el codigo de cliente a 10 dígitos para que SAP no explote ${this.codigoCliente} -> ${codigoClienteNuevo}`);
			this.codigoCliente = codigoClienteNuevo;
		}

		// numeroPedidoOrigen
		this.numeroPedidoOrigen = json.numeroPedidoOrigen.trim();

		// notificaciones: [{tipo: string, valor: string}]
		if (Validador.esArrayNoVacio(json.notificaciones)) {
			this.notificaciones = json.notificaciones.filter(notificacion => {
				if (Validador.esCadenaNoVacia(notificacion.tipo) && Validador.esCadenaNoVacia(notificacion.valor)) {
					return true;
				}
				this.log.warn('Se descarta una notificación por no ser correcta:', notificacion)
				return false;
			}).map(notificacion => { return { tipo: notificacion.tipo, valor: notificacion.valor } })
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
				this.log.warn('El campo "fechaServicio" no va en formato Fedicom3 DateTime dd/mm/yyyy hh:mm:ss');
			}
		}

		// aplazamiento
		if (Validador.existe(json.aplazamiento)) {
			if (Validador.esEnteroPositivoMayorQueCero(json.aplazamiento)) {
				this.aplazamiento = parseInt(json.aplazamiento);
			} else {
				this.log.warn(`El valor "${json.aplazamiento}" como "aplazamiento" no es válido`);
			}
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}



		// Copiamos las líneas, no sin antes analizarlas.
		this.#analizarPosiciones(json.lineas);
		if (this.metadatos.todasLineasInvalidas) {
			this.log.warn(`La transmisión contiene errores de protocolo en todas sus líneas y no será transmitida a SAP`);
			this.metadatos.errores.insertar('PED-ERR-999', 'Existen errores en todas las líneas, el pedido no se procesa.');
		}

		// Para pedidos de mas de (C.pedidos.umbralLineasCrc) líneas, vamos a generar el CRC en función de las propias
		// líneas y no del numeroPedidoOrigen.
		if (this.lineas.length > C.pedidos.umbralLineasCrc) {
			this.metadatos.crc = Crc.generar(this.codigoCliente, this.metadatos.crcAcumuladoLineas, this.codigoAlmacenServicio);
			this.metadatos.tipoCrc = 'lineas';
		} else {
			this.metadatos.crc = Crc.generar(this.codigoCliente, this.numeroPedidoOrigen);
			this.metadatos.tipoCrc = 'numeroPedidoOrigen';
		}
		this.log.info(`Se asigna el siguiente CRC ${this.metadatos.crc} para el pedido usando ${this.metadatos.tipoCrc}`);

	}


	/**
	* Analiza las posiciones de pedido de la petición HTTP.
	* Asume que body.lineas es un array.
	* @param {*} req
	*/
	#analizarPosiciones(lineasJson) {


		this.lineas = [];

		let ordinales = [];

		lineasJson.forEach((linea, i) => {
			let lineaPedido = new LineaPedidoCliente(this.transmision, linea, i);

			// "Acumulamos" el CRC de la linea
			this.metadatos.crcAcumuladoLineas = Crc.generar(this.metadatos.crcAcumuladoLineas, lineaPedido.metadatos.crc);
			this.lineas.push(lineaPedido);

			// Guardamos el ordinal de aquellas lineas que lo llevan para no duplicarlo
			if (lineaPedido.orden) {
				ordinales.push(lineaPedido.orden);
			}

			// Si no tiene errores, ya sabemos que al menos alguna línea debe mandarse a SAP!
			if (!lineaPedido.tieneErrores()) {
				this.metadatos.todasLineasInvalidas = false;
			}

		});

		// Rellenamos los ordinales de las líneas que no lo indiquen.
		let siguienteOrdinal = 1;
		this.lineas.forEach((linea) => {
			if (!linea.orden) {
				while (ordinales.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.orden = siguienteOrdinal;
				siguienteOrdinal++;
			}
		});
	}

	/**
	 * Convierte los códigos de almacén obsoletos en los nuevos códigos. Por ejemplo, el código "02"
	 * era Santomera. Este conver se ha sacado del codigo fuente de Fedicom v2.
	 */
	#converAlmacen() {
		if (!this.codigoAlmacenServicio) return;

		if (!this.codigoAlmacenServicio.startsWith('RG')) {

			const cambiarAlmacen = (nuevoAlmacen) => {
				if (nuevoAlmacen) {
					this.log.info(`Se traduce el código del almacén de ${this.codigoAlmacenServicio} a ${nuevoAlmacen}.`)
					this.codigoAlmacenServicio = nuevoAlmacen;
				} else {
					this.log.info(`No se reconce el código de almacén ${this.codigoAlmacenServicio} - Se elimina el campo para que SAP lo elija`);
					this.codigoAlmacenServicio = null;
					this.metadatos.errores.insertar('PED-WARN-999', 'No se reconoce el código de almacén indicado - Se le asigna su almacén habitual');
					this.metadatos.codigoAlmacenDesconocido = true;
				}
				this.metadatos.codigoAlmacenSaneado = true;
			}

			let codigoFedicom2 = parseInt(this.codigoAlmacenServicio);
			switch (codigoFedicom2) {
				case 2: cambiarAlmacen('RG01'); break;  // Santomera
				case 5: cambiarAlmacen('RG15'); break; // Barcelona viejo
				case 9: cambiarAlmacen('RG19'); break; // Málaga viejo
				case 13: cambiarAlmacen('RG04'); break; // Madrid viejo
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
					cambiarAlmacen('RG' + (codigoFedicom2 > 9 ? codigoFedicom2 : '0' + codigoFedicom2));
					break;
				default:
					cambiarAlmacen(null);
			}
		}

	}

	/**
	 * Genera la URL donde SAP debe confirmar la creación del pedido
	 */
	#generaUrlConfirmacion() {
		return 'http://' + K.HOSTNAME + '.hefame.es:' + C.http.puertoConcentrador + '/confirmaPedido?txId=' + this.transmision.txId.toHexString();
	}


	/**
	 * Genera un JSON con los dataos de la transmisión listo para ser enviado vía HTTP.
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'errores': Se envía el array de errores Fedicom o el pedido sin las faltas
	 */
	generarJSON(tipoReceptor = 'sap') {

		if (this.metadatos.errorProtocoloCabecera || (tipoReceptor !== 'sap' && this.metadatos.esDuplicado)) {
			return this.metadatos.errores.getErrores() || [];
		}

		let json = {
			codigoCliente: this.codigoCliente,
			numeroPedidoOrigen: this.numeroPedidoOrigen,
			lineas: this.lineas.map(l => l.generarJSON(tipoReceptor))
		}

		if (this.notificaciones) json.notificaciones = this.notificaciones;
		if (this.direccionEnvio) json.direccionEnvio = this.direccionEnvio;
		if (this.codigoAlmacenServicio) json.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.tipoPedido) json.tipoPedido = this.tipoPedido;
		if (this.fechaServicio) json.fechaServicio = this.fechaServicio;
		if (this.aplazamiento) json.aplazamiento = this.aplazamiento;
		if (this.observaciones) json.observaciones = this.observaciones;

		if (this.metadatos.errores) json.incidencias = this.metadatos.errores.getErrores();

		if (tipoReceptor === 'sap') {
			json.sap_url_confirmacion = this.#generaUrlConfirmacion();
			json.login = this.transmision.token.getDatosLoginSap();
			json.crc = this.metadatos.crc;
		}

		return json;
	}

	// Control de duplicados
	async esDuplicado() {

		try {
			let fechaLimite = new Date();

			let margenDeTiempo = this.metadatos.tipoCrc === 'lineas' ? C.pedidos.antiguedadDuplicadosPorLineas : C.pedidos.antiguedadDuplicadosMaxima;
			fechaLimite.setTime(fechaLimite.getTime() - margenDeTiempo);

			let consultaCRC = {
				fechaCreacion: { $gt: fechaLimite },
				tipo: K.TIPOS.CREAR_PEDIDO,
				'pedido.crc': this.metadatos.crc
			}
			let opcionesConsultaCRC = {
				projection: { _id: 1, estado: 1 },
				sort: { fechaCreacion: -1 }
			}

			let transmisionOriginal = await M.col.transmisiones.findOne(consultaCRC, opcionesConsultaCRC);

			if (transmisionOriginal?._id) {
				this.log.info(`Se ha detectado transmisión ID '${transmisionOriginal._id}' con idéntico CRC`);

				if (C.pedidos.sePermiteEjecutarDuplicado(transmisionOriginal.estado)) {
					this.log.info(`La transmisión original está en el estado ${transmisionOriginal.estado} que permite la reejecución de duplicados`);
					this.metadatos.esDuplicado = true;
					this.metadatos.esRetransmisionCliente = true;
				} else {
					this.log.warn('Se marca la transmisión como un duplicado');
					this.metadatos.esDuplicado = true;
					this.metadatos.errores.insertar('PED-ERR-008', 'Pedido duplicado: ' + this.metadatos.crc, 400);
					return transmisionOriginal._id;
				}
			} else {
				this.log.debug('No se ha detectado pedido duplicado');
			}
		} catch (errorMongo) {
			this.log.err('No se pudo determinar si el pedido es duplicado:', errorMongo);
			this.metadatos.errorComprobacionDuplicado = true;
		}
		return false;
	}

	contieneErroresProtocolo() {
		return this.metadatos.errorProtocoloCabecera || this.metadatos.todasLineasInvalidas;
	}

	contieneErroresProtocoloEnCabecera() {
		return this.metadatos.errorProtocoloCabecera;
	}

	noTieneLineasValidas() {
		return this.metadatos.todasLineasInvalidas;
	}

	generarCrcUnico() {
		this.metadatos.crc = this.transmision.txId;
		this.metadatos.tipoCrc = 'crcAleatorio';

		this.log.info(`Se establece un CRC aleatorio para el pedido: '${this.metadatos.crc}'.`);
	}

	forzarCrc(crcForzado) {
		this.metadatos.crc = crcForzado;
		this.metadatos.tipoCrc = 'crcForzado';

		this.log.info(`Se fuerza el CRC para el pedido: '${this.metadatos.crc}'.`);
	}

}


module.exports = SolicitudCrearPedido;