'use strict';
const C = global.config;
const K = global.constants;
//const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Crc = require('modelos/CRC');
const Validador = require('global/validador');

const LineaDevolucionCliente = require('modelos/devolucion/LineaDevolucionCliente');
const RespuestaDevolucionSap = require('modelos/devolucion/RespuestaDevolucionSap');

let toMongoLong = require("mongodb").Long.fromNumber;

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionCrearDevolucion extends Transmision {

	#metadatos = {
		errorProtocolo: false,				// (bool) Indica si se han encontrado errores de protocolo en la cabecera
		errorProtocoloTodasLineas: true,	// (bool) Indica si se han encontrado errores de protocolo en todas las posiciones. true mientas no se demuestre lo contrario
		errorTodasLineas: true,				// (bool) Indica si se han encontrado rechazo de SAP para todas las posiciones enviadas. true mientas no se demuestre lo contrario
		errores: null,						// (ErrorFedicom) Listado de errores encontrados en el procesamiento de la transmisión
		crcLineas: '',						// (string) Acumulador del CRC calculado en las líneas
		crc: '',							// (string) CRC del pedido de devolución
		tieneLineasDescartadasPorSap: null,	// (RespuestaDevolucionSap) El objeeto de respuesta con las lineas descartadas por SAP o null si no hay lineas descartadas
		errorClienteNoExiste: false			// (bool) Indica si aparece el error de cliente desconocido en la respuesta de SAP
	}

	#datosEntrada = {
		codigoCliente: null,
		observaciones: null,
		lineasBuenas: [],
		lineasMalas: []
	}

	#respuestasDevolucionSap = [];

	// @Override
	async operar() {

		let json = this.req.body;

		// Comprobamos los campos mínimos que deben aparecer en la CABECERA de una devolucion
		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorFedicom, 'DEV-ERR-002', 'El campo "codigoCliente" es obligatorio');
		Validador.esArrayNoVacio(json.lineas, errorFedicom, 'DEV-ERR-003', 'El campo "lineas" no puede estar vacío');

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias y se lanza una excepción.
		if (errorFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en la cabecera del mensaje', errorFedicom);
			this.#metadatos.errorProtocolo = true;
			this.addError(errorFedicom);
			return;
		}



		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.#datosEntrada.codigoCliente = json.codigoCliente.trim();

		// Valores opcionales que deben comprobarse:
		// observaciones
		if (Validador.esCadenaNoVacia(this.observaciones)) {
			this.#datosEntrada.observaciones = json.observaciones.trim();
		}

		// Análisis de las líneas
		this.#analizarPosiciones();


		// 20.10.2020 - Para evitar duplicados, vamos a generar el CRC siempre con el timestamp actual
		this.#metadatos.crc = Crc.generar(this.#datosEntrada.codigoCliente, this.#metadatos.crcLineas, Date.fedicomTimestamp());


		return await this.#procesarCreacionDeDevolucion();
	}

	/**
	 * Analiza las posiciones de devolución de la petición HTTP.
	 * Asume que req.body.lineas es un array.
	 * @param {*} req 
	 */
	#analizarPosiciones() {

		// Aquí guardaremos los valores del campo "orden" que veamos en las líneas.
		// Lo necesitamos para no repetir valores.
		let ordinales = [];

		this.req.body.lineas.forEach((linea, numeroPosicion) => {
			let lineaDevolucionCliente = new LineaDevolucionCliente(this, linea, numeroPosicion);

			// "Acumulamos" el CRC de la linea
			this.#metadatos.crcLineas = Crc.generar(this.#metadatos.crcLineas, lineaDevolucionCliente.getCrc());

			// Separamos las líneas buenas de las malas.
			if (lineaDevolucionCliente.tieneErroresDeProtocolo()) {
				this.#datosEntrada.lineasMalas.push(lineaDevolucionCliente);
				this.#metadatos.tieneLineasDescartadasPorSap = true;
			} else {
				this.#datosEntrada.lineasBuenas.push(lineaDevolucionCliente);
				this.#metadatos.errorProtocoloTodasLineas = false;
			}

			// Guardamos el orden de aquellas lineas para llevar la cuenta de los ordenes que se han usado.
			if (lineaDevolucionCliente.getOrdinal()) {
				ordinales.push(lineaDevolucionCliente.getOrdinal());
			}
		});

		// Rellenamos el orden en las lineas buenas donde no viene con enteros que no estén usados en otras líneas
		let siguienteOrdinal = 1;
		this.#datosEntrada.lineasBuenas.forEach((linea) => {
			if (!linea.getOrdinal()) {
				// Encontramos el siguiente entero que no esté en uso actualmente
				while (ordinales.includes(siguienteOrdinal)) {
					siguienteOrdinal++;
				}
				linea.setOrdinal(siguienteOrdinal);
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


	async #procesarCreacionDeDevolucion() {

		if (this.#metadatos.errorProtocolo) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.generarJSON('errores'));
		}

		if (this.#metadatos.errorProtocoloTodasLineas) {
			this.log.warn('Todas las lineas contienen errores de protocolo, se responde sin llamar a SAP');
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, [this.generarJSON('lineasInvalidas')]);
		}

		return await this.#enviarDevolucionASap()
	}

	async #enviarDevolucionASap() {

		try {
			this.log.info('Procedemos a enviar a SAP la devolución');
			this.sap.setTimeout(C.sap.timeout.crearDevolucion);
			await this.sap.post('/api/zsd_ent_ped_api/devoluciones', this.generarJSON('sap'));
			this.log.info('Obtenida respuesta de SAP, procedemos a analizarla');
			return await this.#procesarResultadoSap();
		} catch (errorLlamadaSap) {
			this.log.err('Incidencia en la comunicación con SAP, no se graba la devolución', errorLlamadaSap);
			this.addError('DEV-ERR-999', 'No hemos podido grabar la devolución, reinténtelo mas tarde.');
			return new ResultadoTransmision(500, K.ESTADOS.ERROR_RESPUESTA_SAP, this.generarJSON('errores'));
		}

	}


	async #procesarResultadoSap() {

		let cuerpoRespuestaSap = this.sap.getRespuesta();

		if (!Array.isArray(cuerpoRespuestaSap) || !cuerpoRespuestaSap.length) {
			this.log.err('SAP devuelve un cuerpo de respuesta que NO es un array:', cuerpoRespuestaSap);
			this.addError('DEV-ERR-999', 'No hemos podido grabar la devolución, reinténtelo mas tarde.');
			return new ResultadoTransmision(500, K.ESTADOS.ERROR_RESPUESTA_SAP, this.generarJSON('errores'));
		}

		this.log.info(`SAP ha devuelto un total de ${cuerpoRespuestaSap.length} objetos de devolución`);


		// Generamos una 'RespuestaDevolucionSap' por cada elemento devuelto por SAP
		this.#respuestasDevolucionSap = cuerpoRespuestaSap.map((_, indiceRespuesta) => {
			let respuestaDevolucionSap = new RespuestaDevolucionSap(this, indiceRespuesta);

			if (respuestaDevolucionSap.esDeClienteDesconocido()) {
				this.#metadatos.errorClienteNoExiste = true;
				this.addError('DEV-ERR-002', 'El parámetro "codigoCliente" es inválido')
			}
			if (respuestaDevolucionSap.esDeLineasDescartadas()) {
				this.#metadatos.tieneLineasDescartadasPorSap = true;
			} else {
				this.#metadatos.errorTodasLineas = false;
			}
			return respuestaDevolucionSap;
		});


		if (this.#metadatos.errorClienteNoExiste) {
			return new ResultadoTransmision(400, K.ESTADOS.COMPLETADO, respuestaCliente);
		} else {
			// Generamos el JSON de cada respuesta dada por SAP
			let respuestaCliente = this.#respuestasDevolucionSap.map(respuestaDevolucionSap => {
				return respuestaDevolucionSap.generarJSON('respuestaCliente')
			});

			// Si existen lineas malas, incluimos el objeto en la respuesta al cliente
			if (this.#datosEntrada.lineasMalas.length) {
				this.log.warn(`Se incluye una devolución con las ${this.#datosEntrada.lineasMalas.length} líneas que fueron descartadas por no cumplir el protocolo`)
				respuestaCliente.push(this.generarJSON('lineasInvalidas'));
			}


			let codigoRespuestaHttp = 201;
			let estadoTransmision = K.ESTADOS.COMPLETADO;

			if (this.#metadatos.tieneLineasDescartadasPorSap) {
				codigoRespuestaHttp = 206;
				estadoTransmision = K.ESTADOS.DEVOLUCION.PARCIAL;
				if (this.#metadatos.errorTodasLineas) {
					estadoTransmision = K.ESTADOS.DEVOLUCION.RECHAZADA;
				}
			}

			return new ResultadoTransmision(codigoRespuestaHttp, estadoTransmision, respuestaCliente);

		}


	}


	/**
	 * Genera un JSON con los datos de la transmisión listo para ser enviado vía HTTP.
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'lineasInvalidas': Indica que se genere la devolución solo con las líneas detectadas como malas
	 * - 'errores': Se envía el array de errores Fedicom
	 */
	generarJSON(tipoReceptor = 'sap') {

		if (tipoReceptor === 'errores') {
			return this.#metadatos.errores?.getErrores() || [];
		}

		let json = {}

		// Datos que SIEMPRE vamos a capturar de la propia petición
		if (this.#datosEntrada.codigoCliente) json.codigoCliente = this.#datosEntrada.codigoCliente;
		if (this.#metadatos.errores) json.incidencias = this.#metadatos.errores.getErrores();
		if (this.#datosEntrada.observaciones) json.observaciones = this.#datosEntrada.observaciones;

		if (tipoReceptor === 'lineasInvalidas') {
			json.lineas = this.#datosEntrada.lineasMalas.map(lineaMala => lineaMala.generarJSON(tipoReceptor))
		}

		if (tipoReceptor === 'sap') {
			json.login = this.token.getDatosLoginSap();
			json.crc = this.#metadatos.crc;
			json.lineas = this.#datosEntrada.lineasBuenas.map(lineaBuena => lineaBuena.generarJSON(tipoReceptor))
		}

		return json;
	}


	// @Override
	generarMetadatosOperacion() {

		if (this.#metadatos.errorProtocolo) {
			return;
		}

		let metadatos = {
			crc: this.#metadatos.crc,
			totales: {

				lineas: 0,
				lineasIncidencias: 0,
				lineasEstupe: 0,
				cantidad: 0,
				cantidadIncidencias: 0,
				cantidadEstupe: 0
			}
		}

		if (this.#metadatos.errorTodasLineas) metadatos.errorTodasLineas = true;
		if (this.#metadatos.errorProtocoloTodasLineas) metadatos.errorProtocoloTodasLineas = true;
		if (this.#metadatos.existenLineasDescartadas) metadatos.existenLineasDescartadas = true;
		if (this.#metadatos.errorClienteNoExiste) metadatos.errorClienteNoExiste = true;

		this.#datosEntrada.lineasMalas.forEach(lineaMala => {
			metadatos.totales.lineas++;
			metadatos.totales.lineasIncidencias++;
			metadatos.totales.cantidad += lineaMala.getCantidad();
			metadatos.totales.cantidadIncidencias += lineaMala.getCantidad();
		})

		this.#respuestasDevolucionSap.forEach((rds, i) => {

			let d = rds.getDatos();
			let md = rds.getMetadatos();

			if (md.creaOrdenLogistica) metadatos.creaOrdenLogistica = true;
			if (md.devolucionDuplicadaSap) metadatos.devolucionDuplicadaSap = true;
			if (md.incidenciasCabecera) metadatos.incidenciasCabecera = true;
			if (md.puntoEntrega) metadatos.puntoEntrega = md.puntoEntrega;
			if (md.puntoEntrega) metadatos.puntoEntrega = md.puntoEntrega;
			if (md.numerosDevolucionSap.length) {
				if (!metadatos.numerosDevolucionSap) metadatos.numerosDevolucionSap = new Set();
				md.numerosDevolucionSap.forEach(devolucionSap => {
					metadatos.numerosDevolucionSap.add(devolucionSap);
				});
			}

			if (d.codigoCliente) metadatos.codigoCliente = parseInt(d.codigoCliente.slice(-5));
			if (d.numeroDevolucion) metadatos.numeroDevolucion = toMongoLong(parseInt(d.numeroDevolucion));
			if (d.codigoRecogida) metadatos.numeroLogistica = toMongoLong(parseInt(d.codigoRecogida));
			
			metadatos.totales.lineas += md.totales.lineas;
			metadatos.totales.lineasIncidencias += md.totales.lineasIncidencias;
			metadatos.totales.lineasEstupe += md.totales.lineasEstupe;
			metadatos.totales.cantidad += md.totales.cantidad;
			metadatos.totales.cantidadIncidencias += md.totales.cantidadIncidencias;
			metadatos.totales.cantidadEstupe += md.totales.cantidadEstupe;

		});

		if (metadatos.numerosDevolucionSap) {
			metadatos.numerosDevolucionSap = Array.from(metadatos.numerosDevolucionSap);
		}

		this.setMetadatosOperacion('devolucion', metadatos);
	}

}


TransmisionCrearDevolucion.TIPO = K.TIPOS.CREAR_DEVOLUCION;
TransmisionCrearDevolucion.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: null,
	simulaciones: true,
	simulacionesEnProduccion: false
});


module.exports = TransmisionCrearDevolucion;