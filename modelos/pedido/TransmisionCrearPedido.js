'use strict';
const C = global.config;
const K = global.constants;
const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Crc = require('modelos/CRC');
const Validador = require('global/validador');

const LineaPedidoCliente = require('modelos/pedido/LineaPedidoCliente');
const RespuestaPedidoSap = require('./RespuestaPedidoSap');

let toMongoLong = require("mongodb").Long.fromNumber;

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionCrearPedido extends Transmision {

	#metadatos = {							// Metadatos
		errorProtocolo: false,				// Indica si la transmision no sigue el protocolo Fedicom3
		contieneLineasValidas: false,		// Incica si al menos hay alguna línea que se vaya a mandar a SAP
		tipoCrc: 'numeroPedidoOrigen',		// Indica el metodo de generación del CRC (numeroPedidoOrigen | lineas)
		crcAcumuladoLineas: '',				// Acumulador del CRC de líneas
		codigoAlmacenDesconocido: false,	// Indica si se ha encontrado un código de almacén desconocido
		codigoAlmacenSaneado: false,		// Indica si se ha modificado el código de almacén indicado por el usuario.
		errores: null,						// Almacen de los errores que haya que indicar al cliente.
		retransmisionCliente: false,		// Indica si el pedido es un duplicado de otro que acabó en mal estado.
		pedidoDuplicado: false,				// Indica si el pedido es un duplicado de otro que está correcto.
		errorComprobacionDuplicado: false,	// Indica si hubo un error al comprobar si el pedido es duplicado.
		noEnviaFaltas: false,				// Indica que no se enviaron faltas al cliente.
		clienteBloqueadoSap: false,			// Indica si SAP retorna que el cliente está bloqueado.
		incidenciasBloqueoSap: null,		// (ErrorFedicom) Lista de indicencias SAP-IGN devueltas por SAP con el motivo del bloqueo del cliente
		errorRespuestaSap: false,			// Indica si el mensaje devuelto por SAP no es una respuesta de pedidos válida
	};

	#datosEntrada = {						// Campos de ENTRADA estándard de un Pedido en Fedicom3
		codigoCliente: null,
		numeroPedidoOrigen: null,
		notificaciones: null,
		direccionEnvio: null,
		codigoAlmacenServicio: null,
		tipoPedido: null,
		fechaServicio: null,
		aplazamiento: null,
		observaciones: null,
		lineas: null
	}

	#respuestaPedidoSap = null;

	// @Override
	async operar() {
		let json = this.req.body;

		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		Validador.esCadenaNoVacia(json.numeroPedidoOrigen, errorFedicom, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');

		if (json.codigoCliente?.endsWith?.('@hefame')) {
			errorFedicom.insertar('PED-ERR-002', 'Indique el "codigoCliente" sin el @hefame al final', 400);
		}

		if (errorFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en la cabecera del mensaje', errorFedicom);
			this.#metadatos.errorProtocolo = true;
			this.addError(errorFedicom);
			return;
		}


		// codigoCliente
		this.#datosEntrada.codigoCliente = json.codigoCliente.trim();
		// Limpieza del código del cliente.
		// Si tiene mas de 10 dígitos lo truncamos a 10, ya que SAP da error 500 (Imposibol, SAP no falla nunca!)
		if (this.#datosEntrada.codigoCliente.length > 10) {
			let codigoClienteNuevo = this.#datosEntrada.codigoCliente.substring(this.#datosEntrada.codigoCliente.length - 10);
			this.log.warn(`Se trunca el codigo de cliente a 10 dígitos para que SAP no explote ${this.#datosEntrada.codigoCliente} -> ${codigoClienteNuevo}`);
			this.#datosEntrada.codigoCliente = codigoClienteNuevo;
		}

		// numeroPedidoOrigen
		this.#datosEntrada.numeroPedidoOrigen = json.numeroPedidoOrigen.trim();


		// notificaciones: [{tipo: string, valor: string}]
		if (Validador.esArrayNoVacio(json.notificaciones)) {
			this.#datosEntrada.notificaciones = json.notificaciones.filter(n => {
				if (Validador.esCadenaNoVacia(n.tipo) && Validador.esCadenaNoVacia(n.valor))
					return true;
				L.xw(txId, ['Se descarta una notificación por no ser correcta', n])
				return false;
			}).map(n => { return { tipo: n.tipo, valor: n.valor } })
		}

		// direccionEnvio
		if (Validador.esCadenaNoVacia(json.direccionEnvio)) {
			this.#datosEntrada.direccionEnvio = json.direccionEnvio.trim();
		}

		// codigoAlmacenServicio
		if (Validador.esCadenaNoVacia(json.codigoAlmacenServicio)) {
			this.#datosEntrada.codigoAlmacenServicio = json.codigoAlmacenServicio.trim();
			this.#converAlmacen();
		}

		// tipoPedido
		if (Validador.esCadenaNoVacia(json.tipoPedido)) {
			this.#datosEntrada.tipoPedido = json.tipoPedido.trim();
		}

		// fechaServicio
		if (Validador.existe(json.fechaServicio)) {
			if (Validador.esFechaHora(json.fechaServicio)) {
				this.#datosEntrada.fechaServicio = json.fechaServicio.trim();
			} else {
				L.xw(txId, 'El campo "fechaServicio" no va en formato Fedicom3 DateTime dd/mm/yyyy hh:mm:ss');
			}
		}

		// aplazamiento
		if (Validador.existe(json.aplazamiento)) {
			if (Validador.esEnteroPositivoMayorQueCero(json.aplazamiento)) {
				this.#datosEntrada.aplazamiento = parseInt(json.aplazamiento);
			} else {
				L.xw(txId, ['El campo "aplazamiento" no es un entero > 0', json.aplazamiento]);
			}
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.#datosEntrada.observaciones = json.observaciones.trim();
		}



		// Copiamos las líneas, no sin antes analizarlas.
		this.#analizarPosiciones();
		if (!this.#metadatos.contieneLineasValidas) {
			this.log.warn(`La transmisión contiene errores de protocolo en todas sus líneas y no será transmitida a SAP`);
			this.addError('PED-ERR-999', 'Existen errores en todas las líneas, el pedido no se procesa.');
		}

		// 15.02.2021 - Para pedidos de mas de (C.pedidos.umbralLineasCrc) líneas, vamos a generar el CRC en función de las propias
		// líneas y no del numeroPedidoOrigen.
		// 19.04.2021 - Se incluye el código de almacén de servicio 
		if (this.#datosEntrada.lineas.length > C.pedidos.umbralLineasCrc) {
			this.#metadatos.crc = Crc.generar(this.#datosEntrada.codigoCliente, this.#metadatos.crcAcumuladoLineas, this.#datosEntrada.codigoAlmacenServicio);
			this.#metadatos.tipoCrc = 'lineas';
		} else {
			this.#metadatos.crc = Crc.generar(this.#datosEntrada.codigoCliente, this.#datosEntrada.numeroPedidoOrigen);
			this.#metadatos.tipoCrc = 'numeroPedidoOrigen';
		}
		this.log.info(`Se asigna el siguiente CRC ${this.#metadatos.crc} para el pedido usando ${this.#metadatos.tipoCrc}`);


		return await this.#procesarCreacionDePedido();

	}


	/**
	* Analiza las posiciones de pedido de la petición HTTP.
	* Asume que body.lineas es un array.
	* @param {*} req
	*/
	#analizarPosiciones() {

		let lineas = this.req.body.lineas || [];
		this.#datosEntrada.lineas = [];

		let ordinales = [];

		lineas.forEach((linea, i) => {
			let lineaPedido = new LineaPedidoCliente(this, linea, i);

			// "Acumulamos" el CRC de la linea
			this.#metadatos.crcAcumuladoLineas = Crc.generar(this.#metadatos.crcAcumuladoLineas, lineaPedido.getCrc());

			this.#datosEntrada.lineas.push(lineaPedido);

			// Guardamos el ordinal de aquellas lineas que lo llevan para no duplicarlo
			if (lineaPedido.getNumeroPosicion()) {
				ordinales.push(lineaPedido.getNumeroPosicion());
			}

			if (lineaPedido.esLineaCorrecta()) {
				this.#metadatos.contieneLineasValidas = true;
			}


		});

		// Rellenamos los ordinales de las líneas que no lo indiquen.
		let siguienteOrdinal = 1;
		this.#datosEntrada.lineas.forEach((linea) => {
			if (!linea.getNumeroPosicion()) {
				while (ordinales.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.setNumeroPosicion(siguienteOrdinal);
				siguienteOrdinal++;
			}
		});
	}

	/**
	 * Anota un error en la cabecera del pedido
	 * Se puede indicar el (codigo, descripcion) del error, o pasar un único parametro con un objeto instancia de ErrorFedicom
	 * @param {*} codigo 
	 * @param {*} descripcion 
	 */
	addError(codigo, descripcion) {
		if (!this.#metadatos.errores)
			this.#metadatos.errores = new ErrorFedicom();

		this.#metadatos.errores.insertar(codigo, descripcion)
	}

	/**
	 * Convierte los códigos de almacén obsoletos en los nuevos códigos. Por ejemplo, el código "02"
	 * era Santomera. Este conver se ha sacado del codigo fuente de Fedicom v2.
	 */
	#converAlmacen() {

		if (!this.#datosEntrada.codigoAlmacenServicio.startsWith('RG')) {

			const cambiarAlmacen = (nuevoAlmacen) => {
				if (nuevoAlmacen) {
					this.log.info(`Se traduce el código del almacén de ${this.codigoAlmacenServicio} a ${nuevoAlmacen}.`)
					this.#datosEntrada.codigoAlmacenServicio = nuevoAlmacen;
				} else {
					this.log.info(`No se reconce el código de almacén ${this.#datosEntrada.codigoAlmacenServicio} - Se elimina el campo para que SAP lo elija`);
					this.#datosEntrada.codigoAlmacenServicio = null;
					this.addError('PED-WARN-999', 'No se reconoce el código de almacén indicado - Se le asigna su almacén habitual');
					this.#metadatos.codigoAlmacenDesconocido = true;
				}
				this.#metadatos.codigoAlmacenSaneado = true;
			}

			let codigoFedicom2 = parseInt(this.#datosEntrada.codigoAlmacenServicio);
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
		return 'http://' + K.HOSTNAME + '.hefame.es:' + C.http.puertoConcentrador + '/confirmaPedido';
	}



	async #procesarCreacionDePedido() {

		// PASO 1: Verificar si hay errores de protocolo
		if (this.#metadatos.errorProtocolo) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.generarJSON('errores'));
		}
		if (!this.#metadatos.contieneLineasValidas) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.generarJSON('lineasInvalidas'));
		}

		// PASO 2: Verificar si el pedido es duplicado
		if (await this.#esPedidoDuplicado()) {
			return new ResultadoTransmision(400, K.ESTADOS.PEDIDO.DUPLICADO, this.generarJSON('errores'));
		}


		// PASO 3: Enviamos el pedido a SAP
		return await this.#enviarPedidoASap();

	}


	/**
	 * Genera un JSON con los dataos de la transmisión listo para ser enviado vía HTTP.
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'lineasInvalidas': El receptor es un cliente y la transmisión contiene errores en todas las líneas
	 * - 'noSap': El receptor es un cliente y no se han podido determinar las faltas del pedido
	 * - 'errores': Se envía el array de errores Fedicom
	 * - 'respuestaCliente': Si es para enviar la respuesta de faltas al cliente
	 */
	generarJSON(tipoReceptor = 'sap') {

		if (tipoReceptor === 'errores') {
			return this.#metadatos.errores?.getErrores() || [];
		}

		if (tipoReceptor === 'respuestaCliente') {
			// Si SAP ha devuelto errores graves
			let erroresGraves = this.#respuestaPedidoSap.erroresGraves()
			if (erroresGraves) {
				return erroresGraves.getErrores();
			}
		}

		// Como hemos detectado errores en las líneas, sabemos que la cabecera es válida pues se comprueba antes
		let json = {}


		// Datos que SIEMPRE vamos a capturar de la propia petición
		if (this.#datosEntrada.codigoCliente) json.codigoCliente = this.#datosEntrada.codigoCliente;
		if (this.#datosEntrada.numeroPedidoOrigen) json.numeroPedidoOrigen = this.#datosEntrada.numeroPedidoOrigen;
		if (this.#datosEntrada.tipoPedido) json.tipoPedido = this.#datosEntrada.tipoPedido;
		if (this.#datosEntrada.fechaServicio) json.fechaServicio = this.#datosEntrada.fechaServicio;
		if (this.#datosEntrada.aplazamiento) json.aplazamiento = this.#datosEntrada.aplazamiento;

		// 
		if (this.#metadatos.errores) json.incidencias = this.#metadatos.errores.getErrores();


		let fuenteDatos;
		// fuenteDatos apunta a los datos de la respuesta de SAP, o a los datos de la petición del cliente, según el caso:
		if (tipoReceptor === 'respuestaCliente') {
			// La fuente de datos es la respuesta de faltaas obtenida por SAP
			fuenteDatos = this.#respuestaPedidoSap.getDatos();
			// numeroPedido
			json.numeroPedido = this.#metadatos.crc;

			// Adjuntamos incidencias que envíe SAP
			if (Array.isArray(fuenteDatos.incidencias) && fuenteDatos.incidencias.length) {
				if (!Array.isArray(json.incidencias)) json.incidencias = [];
				json.incidencias.concat(fuenteDatos.incidencias)
			}

		} else {
			// La fuente de datos es la propia petición del cliente
			fuenteDatos = this.#datosEntrada;
		}

		if (fuenteDatos.notificaciones) json.notificaciones = fuenteDatos.notificaciones;
		if (fuenteDatos.direccionEnvio) json.direccionEnvio = fuenteDatos.direccionEnvio;
		if (fuenteDatos.codigoAlmacenServicio) json.codigoAlmacenServicio = fuenteDatos.codigoAlmacenServicio;
		if (fuenteDatos.empresaFacturadora) json.empresaFacturadora = fuenteDatos.empresaFacturadora;
		if (fuenteDatos.observaciones) json.observaciones = fuenteDatos.observaciones;
		if (fuenteDatos.lineas) json.lineas = fuenteDatos.lineas.map(l => l.generarJSON(tipoReceptor));

		if (tipoReceptor === 'sap') {
			json.sap_url_confirmacion = this.#generaUrlConfirmacion();
			json.login = this.token.getDatosLoginSap();
			json.crc = this.#metadatos.crc;
		}

		return json;
	}

	// Control de duplicados
	async #esPedidoDuplicado() {

		try {
			let fechaLimite = new Date();

			let margenDeTiempo = this.#metadatos.tipoCrc === 'lineas' ? C.pedidos.antiguedadDuplicadosPorLineas : C.pedidos.antiguedadDuplicadosMaxima;
			fechaLimite.setTime(fechaLimite.getTime() - margenDeTiempo);

			let consultaCRC = {
				fechaCreacion: { $gt: fechaLimite },
				tipo: K.TIPOS.CREAR_PEDIDO,
				'pedido.crc': this.#metadatos.crc
			}
			let opcionesConsultaCRC = {
				projection: { _id: 1, estado: 1 }
			}

			let transmisionOriginal = await M.col.transmisiones.findOne(consultaCRC, opcionesConsultaCRC);

			if (transmisionOriginal?._id) {
				this.log.info(`Se ha detectado otra transmisión con idéntico CRC ${transmisionOriginal._id}`);

				// TODO: Determinar lista de estados que ignoraremos a nivel de configuración de clúster
				if (transmisionOriginal.estado === K.ESTADOS.PEDIDO.RECHAZADO_SAP) {
					this.log.info('La transmisión original fue rechazada por SAP, no la tomamos como repetida');
					this.#metadatos.retransmisionCliente = true;
				} else {
					this.log.warn('Se marca la transmisión como un duplicado');
					this.addError('PED-ERR-008', 'Pedido duplicado: ' + this.#metadatos.crc, 400);
					this.#metadatos.pedidoDuplicado = true;
					return true;
				}
			} else {
				this.log.debug('No se ha detectado pedido duplicado');
			}
		} catch (errorMongo) {
			this.log.err('No se pudo determinar si el pedido es duplicado:', errorMongo);
			this.#metadatos.errorComprobacionDuplicado = true;
		}
		return false;
	}

	async #enviarPedidoASap() {

		try {
			this.log.info('Procedemos a enviar a SAP el pedido');
			this.sap.setTimeout(C.sap.timeout.crearPedido);
			await this.sap.post('/api/zsd_ent_ped_api/pedidos', this.generarJSON('sap'));
			this.log.info('Obtenida respuesta de SAP, procedemos a analizarla');
			return await this.#procesarResultadoSap();
		} catch (errorLlamadaSap) {
			this.log.err('Incidencia en la comunicación con SAP, se simulan las faltas del pedido', errorLlamadaSap);
			this.addError('PED-WARN-001', 'Su pedido se ha recibido correctamente, pero no hemos podido informar las faltas.');
			this.#metadatos.noEnviaFaltas = true;
			return new ResultadoTransmision(201, K.ESTADOS.PEDIDO.NO_SAP, this.generarJSON('noSap'));
		}

	}

	async #procesarResultadoSap() {

		let cuerpoRespuestaSap = this.sap.getRespuesta();

		// Si la respuesta de SAP es un array de incidencias, es un pedido rechazado por SAP
		// Sanearemos las mismas por si vienen errores de bloqueos.
		if (Array.isArray(cuerpoRespuestaSap)) {

			this.log.warn('SAP devuelve un cuerpo de respuesta que es un array con errores de rechazo:', cuerpoRespuestaSap);
			// Eliminamos las incidencias cuyo código comienza por 'SAP-IGN', ya que dan información sobre el bloqueo del cliente
			// y no queremos que esta información se mande al cliente.
			cuerpoRespuestaSap.filter(incidencia => {
				if (incidencia?.codigo?.startsWith('SAP-IGN')) {
					this.#metadatos.clienteBloqueadoSap = true;
					if (!this.#metadatos.incidenciasBloqueoSap) this.#metadatos.incidenciasBloqueoSap = new ErrorFedicom();
					this.#metadatos.incidenciasBloqueoSap.insertar(incidencia);
					return false;
				}
				return true;
				// Para las incidencias que pasen el filtro, las añadimos a la lista de errores.
			}).forEach(incidencia => {
				this.addError(incidencia.codigo, incidencia.descripcion);
			});

			// Si el cliente está bloqueado, agregamos la incidencia de error de bloqueo en SAP y levantamos el Flag
			if (this.#metadatos.clienteBloqueadoSap) {
				this.log.warn('SAP indica que el cliente tiene bloqueos de pedidos');
				this.addError('PED-ERR-999', 'No se pudo guardar el pedido. Contacte con su comercial.');
			}

			return new ResultadoTransmision(409, K.ESTADOS.PEDIDO.RECHAZADO_SAP, this.generarJSON('errores'));
		}

		// BUG: En ocasiones, SAP devolvía un string que no era un JSON. Esto parece que ya no ocurre con el cambio a 'axios'
		// pero dejamos la comprobación por si acaso
		if (!cuerpoRespuestaSap?.crc) {
			this.log.err('SAP devuelve un cuerpo de respuesta que no es un objeto válido. Se devuelve error de faltas simuladas', cuerpoRespuestaSap);
			this.#metadatos.errorRespuestaSap = true;
			return new ResultadoTransmision(409, K.ESTADOS.PEDIDO.NO_SAP, this.generarJSON('noSap'));
		}

		this.#respuestaPedidoSap = new RespuestaPedidoSap(this);

		let respuestaCliente = this.generarJSON('respuestaCliente');
		let estadoTransmision = this.#respuestaPedidoSap.determinarEstadoTransmision();

		return new ResultadoTransmision(estadoTransmision.codigoRetornoHttp, estadoTransmision.estadoTransmision, respuestaCliente);


	}

	// @Override
	generarMetadatosOperacion() {

		if (this.#metadatos.errorProtocolo) {
			return;
		}

		let metadatos = {};

		metadatos.codigoCliente = parseInt(this.#datosEntrada.codigoCliente.slice(-5)) || null;
		metadatos.tipoPedido = parseInt(this.#datosEntrada.tipoPedido) || 0;
		metadatos.crc = this.#metadatos.crc;
		metadatos.crcSap = parseInt(this.#metadatos.crc.toString().substring(0, 8), 16);
		metadatos.tipoCrc = this.#metadatos.tipoCrc;

		if (this.#metadatos.codigoAlmacenDesconocido) metadatos.codigoAlmacenDesconocido = true;
		if (this.#metadatos.codigoAlmacenSaneado) metadatos.codigoAlmacenSaneado = true;
		if (this.#metadatos.retransmisionCliente) metadatos.retransmisionCliente = true;
		if (this.#metadatos.errorComprobacionDuplicado) metadatos.errorComprobacionDuplicado = true;
		if (this.#metadatos.noEnviaFaltas) metadatos.noEnviaFaltas = true;
		if (this.#metadatos.clienteBloqueadoSap) metadatos.clienteBloqueadoSap = true;

		if (this.#respuestaPedidoSap) {

			let d = this.#respuestaPedidoSap.getDatos();
			let md = this.#respuestaPedidoSap.getMetadatos();

			if (d.codigoAlmacenServicio) metadatos.codigoAlmacen = d.codigoAlmacenServicio;
			if (md.puntoEntrega) metadatos.puntoEntrega = md.puntoEntrega;
			if (md.tipoPedidoSap) metadatos.tipoPedidoSap = md.tipoPedidoSap;
			if (md.motivoPedidoSap) metadatos.motivoPedidoSap = md.motivoPedidoSap;
			if (md.clienteSap) metadatos.clienteSap = md.clienteSap;

			if (md.pedidosAsociadosSap?.length) metadatos.pedidosAsociadosSap = md.pedidosAsociadosSap.map(nPed => toMongoLong(nPed));
			if (md.pedidoAgrupadoSap) metadatos.pedidoAgrupadoSap = toMongoLong(md.pedidoAgrupadoSap);

			if (md.reboteFaltas) metadatos.reboteFaltas = md.reboteFaltas;
			if (md.porRazonDesconocida) metadatos.porRazonDesconocida = md.porRazonDesconocida;
			if (md.pedidoProcesadoSinNumero) metadatos.pedidoProcesadoSinNumero = md.pedidoProcesadoSinNumero;
			if (md.servicioDemorado) metadatos.servicioDemorado = md.servicioDemorado;
			if (md.estupefaciente) metadatos.estupefaciente = md.estupefaciente;

			if (md.totales) metadatos.totales = md.totales;

		}

		this.setMetadatosOperacion('pedido', metadatos);
	}
}



TransmisionCrearPedido.TIPO = K.TIPOS.CREAR_PEDIDO;
TransmisionCrearPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupo: null,
	simulaciones: true,
	simulacionesEnProduccion: false,
});


module.exports = TransmisionCrearPedido;