'use strict';
const C = global.C;
const K = global.K;
const M = global.M;


const Modelo = require('modelos/transmision/Modelo');
const ErrorFedicom = require('modelos/ErrorFedicom');

const Crc = require('global/crc');
const Validador = require('global/validador');

const DireccionLogistica = require('modelos/logistica/DireccionLogistica');
const LineaLogisticaCliente = require('modelos/logistica/LineaLogisticaCliente');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class SolicitudCrearLogistica extends Modelo {

	metadatos = {							// Metadatos
		errores: new ErrorFedicom(),		// Errores encontrados al instanciar la solicitud
		errorProtocoloCabecera: false,		// Indica si la transmisión no tiene la cabecera según el protocolo
		todasLineasInvalidas: true,			// Indica si la transmisión no contiene ninguna línea válida según el protocolo
		esDuplicado: false,
		esRetransmisionCliente: false,		// Indica si es un intento de retransmisión del cliente de una transmisión que quedó erronea
		errorComprobacionDuplicado: false,	// Indica si no se pudo chequear si la transmisión es un duplicado de otra
		crc: ''								// El CRC de la transmisión
	};
	
	// Campos de la solicitud SANEADOS
	codigoCliente;				// (string)
	numeroLogisticaOrigen;		// (string)
	tipoLogistica;				// (string + .trim().toUpperCase()) Debe ser de la lista de tipos válidos 
	origen;						// (DireccionLogistica)
	destino;					// (DireccionLogistica)
	fechaRecogidaSolicitada;	// (string) Formato Fedicom3 Date
	observaciones;				// (string)
	lineas;						// (Array<LineaLogisticaCliente>)

	
	constructor(transmision) {
		super(transmision);
		let json = transmision.req.body;

		this.log.info('Analizando la solicitud de crear orden de logística')

		// Comprobamos los campos mínimos que deben aparecer en la CABECERA de un pedido de logística
		let errorProtocoloFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoCliente, errorProtocoloFedicom, 'LOG-ERR-000', 'El campo "codigoCliente" es obligatorio');
		Validador.esCadenaNoVacia(json.numeroLogisticaOrigen, errorProtocoloFedicom, 'LOG-ERR-000', 'El campo "numeroLogisticaOrigen" es obligatorio')

		let tipoLogisticaSaneado;
		if (Validador.esCadenaNoVacia(json.tipoLogistica, errorProtocoloFedicom, 'LOG-ERR-000', 'El campo "tipoLogistica" es obligatorio')) {
			tipoLogisticaSaneado = json.tipoLogistica.toString().trim().toUpperCase();
			let descripcionTipoLogistica = C.logistica.tiposAdmitidos[tipoLogisticaSaneado];
			if (!descripcionTipoLogistica) {
				this.log.warn(`El valor "${json.tipoLogistica}" del campo "tipoLogistica" no es válido`);
				errorProtocoloFedicom.insertar('LOG-ERR-000', 'El campo "tipoLogistica" no tiene un valor válido');
			}
		}

		let direccionOrigen = new DireccionLogistica(this.transmision, json.origen, 'origen');
		if (direccionOrigen.esErronea()) {
			direccionOrigen.getErrores().forEach((err) => errorProtocoloFedicom.insertar(err));
		}

		let direccionDestino = new DireccionLogistica(this.transmision, json.destino, 'destino');
		if (direccionDestino.esErronea()) {
			direccionDestino.getErrores().forEach((err) => errorProtocoloFedicom.insertar(err));
		}

		Validador.esArrayNoVacio(json.lineas, errorProtocoloFedicom, 'LOG-ERR-000', 'El campo "lineas" no puede estar vacío');

		// Si se encuentran errores:
		if (errorProtocoloFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en la cabecera del mensaje', errorProtocoloFedicom);
			this.metadatos.errorProtocoloCabecera = true;
			this.metadatos.errores.insertar(errorProtocoloFedicom);
			return;
		}


		// Copiamos las propiedades de la CABECERA que son relevantes
		// Valores comprobados previamente y que son obligatorios:
		this.codigoCliente = json.codigoCliente.trim();
		this.numeroLogisticaOrigen = json.numeroLogisticaOrigen.trim();
		this.tipoLogistica = json.tipoLogistica.trim().toUpperCase();
		this.origen = direccionOrigen;
		this.destino = direccionDestino;
		
		// fechaRecogidaSolicitada
		if (Validador.esFechaHora(json.fechaRecogidaSolicitada)) {
			this.fechaRecogidaSolicitada = json.fechaRecogidaSolicitada.trim();
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

		// Copiamos las líneas, no sin antes analizarlas.
		this.#analizarPosiciones(json.lineas);
		if (this.metadatos.todasLineasInvalidas) {
			this.log.warn(`La transmisión contiene errores de protocolo en todas sus líneas y no será transmitida a SAP`);
			this.metadatos.errores.insertar('LOG-ERR-000', 'Existen errores en todas las líneas, la orde de logística no se procesa.')
		}

		// Generación del CRC
		this.metadatos.crc = Crc.generar(this.codigoCliente, this.numeroLogisticaOrigen);
		this.log.info(`Se asigna el siguiente CRC ${this.metadatos.crc} para la orden de logística`);
	}

	/**
	* Analiza las posiciones de pedido de la petición HTTP.
	* Asume que body.lineas es un array no vacío.
	* @param {*} req
	*/
	#analizarPosiciones(lineasJson) {

		this.lineas = [];
		let ordenes = [];

		lineasJson.forEach((linea, i) => {
			let lineaLogistica = new LineaLogisticaCliente(this, linea, i);
			this.lineas.push(lineaLogistica);

			// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
			if (lineaLogistica.orden) {
				ordenes.push(lineaLogistica.orden);
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

	contieneErroresProtocolo() {
		return this.metadatos.errorProtocoloCabecera || this.metadatos.todasLineasInvalidas;
	}

	contieneErroresProtocoloEnCabecera() {
		return this.metadatos.errorProtocoloCabecera;
	}

	noTieneLineasValidas() {
		return this.metadatos.todasLineasInvalidas;
	}


	/**
	 * Control de duplicados
	 */
	async esDuplicado() {

		try {
			let fechaLimite = new Date();

			let margenDeTiempo = C.pedidos.antiguedadDuplicadosMaxima;
			fechaLimite.setTime(fechaLimite.getTime() - margenDeTiempo);

			let consultaCRC = {
				fechaCreacion: { $gt: fechaLimite },
				tipo: K.TIPOS.CREAR_LOGISTICA,
				'logistica.crc': this.metadatos.crc
			}
			let opcionesConsultaCRC = {
				projection: { _id: 1, estado: 1 }
			}

			let transmisionOriginal = await M.col.transmisiones.findOne(consultaCRC, opcionesConsultaCRC);

			if (transmisionOriginal?._id) {
				this.log.info(`Se ha detectado otra transmisión con idéntico CRC ${transmisionOriginal._id}`);

				// TODO: Determinar lista de estados que ignoraremos a nivel de configuración de clúster
				if (transmisionOriginal.estado === K.ESTADOS.LOGISTICA.SIN_NUMERO_LOGISTICA ||
					transmisionOriginal.estado === K.ESTADOS.RECHAZADO_SAP ||
					transmisionOriginal.estado === K.ESTADOS.FALLO_AUTENTICACION ||
					transmisionOriginal.estado === K.ESTADOS.PETICION_INCORRECTA) {
					this.log.info('La transmisión original no se llegó a materializar, no la tomamos como repetida');
					this.metadatos.esRetransmisionCliente = true;
				} else {
					this.log.warn('Se marca la transmisión como un duplicado');
					this.metadatos.esDuplicado = true;
					this.metadatos.errores.insertar('LOG-ERR-008', 'Solicitud de logística duplicada');
					return true;
				}
			} else {
				this.log.debug('No se ha detectado logística duplicada');
			}
		} catch (errorMongo) {
			this.log.err('No se pudo determinar si la logística es duplicada:', errorMongo);
			this.metadatos.errorComprobacionDuplicado = true;
		}
		return false;
	}

	/**
	 * Genera un JSON con los dataos de la transmisión listo para ser enviado vía HTTP.
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'errores': El receptor es un cliente y la transmisión no se procesa por errores del protocolo
	 */
	generarJSON(tipoReceptor = 'sap') {

		if (this.metadatos.errorProtocoloCabecera || this.metadatos.esDuplicado) {
			return this.metadatos.errores.getErrores() || [];
		}

		let json = {
			codigoCliente: this.codigoCliente,
			numeroLogisticaOrigen: this.numeroLogisticaOrigen,
			tipoLogistica: this.tipoLogistica,
			origen: this.origen,
			destino: this.destino,
		}

		if (this.fechaRecogidaSolicitada) json.fechaRecogidaSolicitada = this.fechaRecogidaSolicitada;
		if (this.observaciones) json.observaciones = this.observaciones;

		json.lineas = this.lineas.map(l => l.generarJSON(tipoReceptor));

		if (this.metadatos.errores.tieneErrores()) json.incidencias = this.metadatos.errores.getErrores();

		if (tipoReceptor === 'sap') {
			json.login = this.transmision.token.getDatosLoginSap();
			json.crc = this.metadatos.crc;
		}

		return json;
	}

}



module.exports = SolicitudCrearLogistica;