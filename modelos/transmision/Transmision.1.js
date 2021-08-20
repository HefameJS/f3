'use strict';
const K = global.K;
const M = global.M;
const L = global.L;
const Token = require('./Token');
const MetadatosOperacion = require('./MetadatosOperacion');
const MetadatosConexionEntrante = require('./MetadatosConexionEntrante');
const IntercambioSap = require('./IntercambioSap');
const ResultadoTransmision = require('./ResultadoTransmision');
const ErrorFedicom = require('modelos/ErrorFedicom');


/**
 * Representación de la transmisión que se está procesando en el concentrador.
 * La clase permite conocer y manejar el flujo y ciclo de vida de cada transmisión.
 */
class TransmisionB extends Object {


	#http;						// Contiene la peticion y respuesta de Express {req, res}
	// Contiene un campo adicional "respuesta" que indica el estado de la respuesta dada al cliente:
	// 		.enviada (Boolean) Indica si se ha INTENTADO o no enviar una respuesta (independientemente del resultado)
	// 		.codigo (Numeric) Indica el código de estado HTTP de la respuesta (null si no hay respuesta)
	// 		.cuerpoRespuesta (Object) Especifica el objeto enviado en la respuesta (null si no hay respuesta)
	//		.error (Error) Un objeto de error si la respuesta no pudo enviarse (null si no hay error)

	
	txId;						// (ObjectID) El ID único de la transmisión.
	log;						// (Log) El gestor de log para esta transmisión.
	fechaCreacion;				// (Date) Fecha de creación de la transmisión.
	#estado;					// (integer) El estado de la transmisión. Ej, RECEPCIONADA, ESPERANDO FALTAS ....
	#tipo;						// (integer) El tipo de la transmisión. Ej. AUTENTICACION, CREAR PEDIDO, ....
	token;						// (Token) Datos del token transmitido en la transmisión.
	#intercambioSap				// (IntercambioSap) Interfaz de comunicación con SAP.


	static async ejecutar(req, res, ClaseTransmisionB, datosDeOperacion) {

		// Instancia la transmisión (notese que las transmisiones NO DEBEN sobreescribir el constructor por defecto)
		let transmision = new ClaseTransmisionB(req, res, ClaseTransmision.CONDICIONES_AUTORIZACION);
		// Registra en la base de datos la transisión como recepcionada
		await transmision.#registrarTransmision();

		// Comprobación de que el usuario pueda ejecutar la transmisión.
		let ejecucionAutorizada = await transmision.#chequeoAutorizacion()
		if (ejecucionAutorizada) {
			try {
				// Ejecuta la operacion ( metodo operar() que debe sobreescribirse ), de debe devolver un objeto de tipo ResultadoOperacion
				let resultadoOperacion = await transmision.operar(datosDeOperacion);
				// Responde al cliente HTTP y establece el estado de la transmisión
				await resultadoOperacion.responderTransmision(transmision);
			} catch (truenoTransmision) {
				// En caso de fallo, generamos un DUMP!
				transmision.log.dump(truenoTransmision);
				transmision.log.fatal('LA TRANSMISION HA PEGADO UN TRUENO Y GENERANDO UN DUMP')
				transmision.log.fatal(truenoTransmision.stack)
			}
		}
		// Registra en la base de datos el resultado de la transmisión.
		await transmision.#actualizarTransmision();
	}

	constructor(req, res, tipo, condicionesAutorizacion) {
		super();

		this.txId = new M.ObjectID();
		this.fechaCreacion = new Date();
		this.#estado = K.ESTADOS.RECEPCIONADO;
		this.#tipo = tipo;

		this.log = L.instanciar(this);
		this.log.evento(`------------------------ ${this.txId} ------------------------`);
		this.log.evento(`Se da entrada a la transmisión ${this.constructor.name}. [tipo=${this.#tipo}, estado=${this.#estado}]`);

		this.#http = {
			req,
			res,
			respuesta: {
				enviada: false,
				codigo: null,
				datos: null,
				error: null
			}
		};
		this.token = new Token(this, condicionesAutorizacion);
		this.#intercambioSap = new IntercambioSap(this);

		this.#metadatosConexionEntrante = new MetadatosConexionEntrante(this);
		this.#metadatosOperacion = new MetadatosOperacion();
	}


	/**
	 * Método abstracto que las clases que hereden deben implementar.
	 * DEBE DEVOLVER UN OBJETO ResultadoTransmision.
	 */
	async operar() {
		this.log.fatal('Intento de operar sobre una transmisión que no tiene redefinido el método operar()')
		return new ResultadoTransmision(503, K.ESTADOS.PETICION_INCORRECTA,)
	}



	/**
	 * Obtiene el objecto request de express
	 */
	get req() {
		return this.#http.req;
	}

	/**
	 * Obtiene el objecto response de express
	 */
	get res() {
		return this.#http.res;
	}

	/**
	 * Obtiene la instancia del interfaz de intercambio de mensajes HTTP con SAP
	 */
	get sap() {
		return this.#intercambioSap;
	}



	/**
	 * Envía una respuesta a la solicitud HTTP del cliente.
	 * 
	 * @param {ErrorFedicom|Object|Buffer} datos Los datos a enviar
	 * @param {number} codigoEstado El código de estado de la respuesta HTTP. Por defecto 200.
	 * @param {string} contentType El valor para la cabecera 'Content-Type' de la respuesta. Por defecto: 'application/json'.
	 * @param {string} nombreFichero El nombre con el que se descarga el fichero.
	 */
	async responder(datos, codigoEstado, contentType = 'application/json', nombreFichero) {

		if (this.#http.res.headersSent) {
			this.log.fatal('Se está intentando enviar una respuesta HTTP por segunda vez', datos, codigoEstado);
			return;
		}

		this.#http.res.setHeader('X-TxID', this.txId);
		this.#http.res.setHeader('Software-ID', K.SOFTWARE_ID.SERVIDOR);
		this.#http.res.setHeader('Content-Api-Version', K.VERSION.PROTOCOLO);

		this.#http.res.setHeader('Content-Type', contentType);
		if (nombreFichero) this.#http.res.setHeader('Content-Disposition', 'attachment; filename=' + nombreFichero);

		if (ErrorFedicom.esErrorFedicom(datos)) {
			codigoEstado = codigoEstado || datos.getCodigoRespuestaHttp();
			datos = datos.getErrores();
		} else {
			codigoEstado = codigoEstado || 200;
		}

		try {
			let respuesta = await this.#http.res.status(codigoEstado).send(datos);
			this.log.info(`Se ha enviado una respuesta ${respuesta.statusCode} - ${respuesta.statusMessage} al cliente`);
			if (!Buffer.isBuffer(datos))
				this.#http.respuesta.datos = datos;
			else 
				this.#http.respuesta.datos = {
					nombreFichero: nombreFichero,
					formato: contentType,
					bytes: datos.byteLength
				};
			this.#http.respuesta.codigo = codigoEstado;
		} catch (errorRespuesta) {
			this.log.err('No se pudo enviar la respuesta al cliente por un error en el socket', errorRespuesta);
			this.#http.respuesta.error = errorRespuesta;
		}

		this.#http.respuesta.enviada = true;

	}

	/**
	 * Comprueba que la petición esté autenticada y que el usuario autenticado esté autorizado a ejecutarla. 
	 * En caso afirmativo devuelve true, en caso negativo devuelve false y responde al cliente con un error de autenticación
	 * o autorización, según corresponda.
	 * @returns true si la autorización es correcta, false de lo contrario. 
	 */
	async #chequeoAutorizacion() {

		let errorToken = this.token.getError();
		if (errorToken) {
			let codigoRespuesta = errorToken.getCodigoRespuestaHttp()
			let estadoTransmision = codigoRespuesta === 401 ? K.ESTADOS.FALLO_AUTENTICACION : K.ESTADOS.FALLO_AUTORIZACION;
			let resultadoTransmision = new ResultadoTransmision(codigoRespuesta, estadoTransmision, errorToken.getErrores())
			await resultadoTransmision.responderTransmision(this);
			return false;
		}

		return true;

	}




}



module.exports = TransmisionB;