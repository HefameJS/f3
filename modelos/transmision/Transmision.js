'use strict';
const K = global.constants;
const M = global.mongodb;


const Token = require('modelos/transmision/Token');
const MetadatosOperacion = require('modelos/transmision/MetadatosOperacion');
const MetadatosConexionEntrante = require('modelos/transmision/MetadatosConexionEntrante');
const LogTransmision = require('modelos/transmision/LogTransmision');
const IntercambioSap = require('modelos/transmision/IntercambioSap');
const iSQLite = require('interfaces/iSQLite');
const ErrorFedicom = require('modelos/ErrorFedicom');
const ResultadoTransmision = require('./ResultadoTransmision');


/**
 * Representación de la transmisión que se está procesando en el concentrador.
 * La clase permite conocer y manejar el flujo y ciclo de vida de cada transmisión.
 */
class Transmision extends Object {


	#http;						// Contiene la peticion y respuesta de Express {req, res}
	// Contiene un campo adicional "respuesta" que indica el estado de la respuesta dada al cliente:
	// 		.enviada (Boolean) Indica si se ha INTENTADO o no enviar una respuesta (independientemente del resultado)
	// 		.codigo (Numeric) Indica el código de estado HTTP de la respuesta (null si no hay respuesta)
	// 		.cuerpoRespuesta (Object) Especifica el objeto enviado en la respuesta (null si no hay respuesta)
	//		.error (Error) Un objeto de error si la respuesta no pudo enviarse (null si no hay error)

	
	txId;						// (ObjectID) El ID único de la transmisión.
	log;						// (LogTransmision) El gestor de log para esta transmisión.
	fechaCreacion;				// (Date) Fecha de creación de la transmisión.
	#estado;					// (integer) El estado de la transmisión. Ej, RECEPCIONADA, ESPERANDO FALTAS ....
	#tipo;						// (integer) El tipo de la transmisión. Ej. AUTENTICACION, CREAR PEDIDO, ....
	token;						// (Token) Datos del token transmitido en la transmisión.
	#intercambioSap				// (IntercambioSap) Interfaz de comunicación con SAP.
	#metadatosConexionEntrante;	// (MetadatosConexionEntrante) Metadatos de la conexión entrante.
	#metadatosOperacion;		// (MetadatosOperacion) Objeto en el que se manejan los metadatos de la operación llevada a cabo en esta transmision.


	static async ejecutar(req, res, ClaseTransmision, datosDeOperacion) {

		let transmision = new ClaseTransmision(req, res, ClaseTransmision.TIPO, ClaseTransmision.CONDICIONES_AUTORIZACION);
		await transmision.#registrarTransmision();

		if (await transmision.#responderFalloAutorizacion()) {
			try {
				let resultadoOperacion = await transmision.operar(datosDeOperacion);
				await resultadoOperacion.responderTransmision(transmision);
				await transmision.generarMetadatosOperacion();
				
			} catch (truenoTransmision) {
				console.log('OJO QUE HA PEGADO UN TRUENO')
				console.log(truenoTransmision.stack)
			}
		}

		await transmision.#actualizarTransmision();
	}

	constructor(req, res, tipo, condicionesAutorizacion) {
		super();

		this.txId = new M.ObjectID();
		this.fechaCreacion = new Date();
		this.#estado = K.ESTADOS.RECEPCIONADO;
		this.#tipo = tipo;

		this.log = new LogTransmision(this);
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
	 * Método abstracto que las clases que hereden deben implementar.
	 * Debe usar el método setMetadatosOperacion(nombre, valor) para establecer tantos metadatos como necesite
	 */
	async generarMetadatosOperacion() {
		this.log.warn('El objeto de transmisión no tiene redefinido el método generarMetadatosOperacion()');
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
	 * Establece el estado de la transmision
	 * @param {*} estado El nuevo estado
	 */
	setEstado(estado) {
		this.log.evento(`La transmisión pasa de estado ${this.#estado} a ${estado}`);
		this.#estado = estado;
	}

	/**
	 * Establece el valor del Flag indicado
	 * @param {*} nombre El nombre del flag
	 * @param {*} valor El nuevo valor del flag
	 */
	setMetadatosOperacion(nombre, valor) {
		this.log.debug(`Establecidos metadatos de la operacion '${nombre}':`, valor);
		this.#metadatosOperacion.insertar(nombre, valor);
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
	 * Envía una respuesta de fallo de autenticación/autorización a la solicitud HTTP del cliente si el token 
	 * no es válido para realizar la operación solicitada.
	 * @returns false si el token no es valido y por tanto se respondió al cliente. true si el token es correcto y se debe operar.
	 */
	async #responderFalloAutorizacion() {

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

	#generarMetadatosConexion() {

		//Flag de transimision
		return {
			ip: this.#metadatosConexionEntrante.ip,
			autenticacion: this.token.generarFlag(),
			programa: this.#metadatosConexionEntrante.programa,
			ssl: this.#metadatosConexionEntrante.ssl,
			balanceador: this.#metadatosConexionEntrante.balanceador,
			concentrador: this.#metadatosConexionEntrante.concentrador
		}

	}

	async #registrarTransmision() {

		let sentencia = {
			$setOnInsert: {
				_id: this.txId,
				fechaCreacion: this.fechaCreacion
			},
			$set: {
				estado: this.#estado,
				tipo: this.#tipo,
				v: K.VERSION.TRANSMISION,
				'conexion.solicitud': {
					method: this.#http.req.method,
					url: this.#http.req.originalUrl,
					headers: this.#http.req.headers,
					body: this.#http.req.body
				},
				'conexion.metadatos': this.#generarMetadatosConexion()
			}
		}

		try {
			await M.col.transmisiones.updateOne({ _id: this.txId }, sentencia, { upsert: true });
			this.log.debug('La transmision ha sido registrada en la base de datos');
		} catch (errorMongo) {
			this.log.err('Error al registrar la transmisión en la base de datos', errorMongo);

			try {
				let uid = await iSQLite.grabarTransaccion(sentencia);
				this.log.warn(`La transmision ha sido registrada en la base de datos local con UID ${uid}`);
			} catch (errorSQLite) {
				this.log.fatal('La transmisión no ha podido ser registrada', errorSQLite)
			}
			return false;
		}
	}

	async #actualizarTransmision() {

		let sentencia = {
			$setOnInsert: {
				_id: this.txId,
				fechaCreacion: this.fechaCreacion
			},
			$max: {
				estado: this.#estado,
			},
			$set: {
				tipo: this.#tipo,
				'conexion.respuesta': {
					fechaEnvio: new Date(),
					codigo: this.#http.respuesta.codigo,
					headers: this.#http.res.getHeaders(),
					body: this.#http.respuesta.datos,
					error: (this.#http.respuesta.error ? this.#http.respuesta.error.toString() : undefined)
				}
			}
		}

		// SAP
		// Si se ha efectuado transmision a SAP, grabamos la inforamción de la misma
		if (this.#intercambioSap.intercambioEjecutado())
			sentencia['$set'].sap = this.#intercambioSap.generarMetadatosSap()


		// Metadatos de la operacion
		this.#metadatosOperacion.sentenciar(sentencia);


		try {
			await M.col.transmisiones.updateOne({ _id: this.txId }, sentencia, { upsert: true });
			this.log.debug('La transmision ha sido actualizada en la base de datos');
		} catch (errorMongo) {
			this.log.err('Error al actualizar la transmisión en la base de datos', errorMongo);

			try {
				let uid = await iSQLite.grabarTransaccion(sentencia);
				this.log.warn(`La actualización ha sido registrada en la base de datos local con UID ${uid}`);
			} catch (errorSQLite) {
				this.log.fatal('La actualización no ha podido ser registrada', errorSQLite)
			}
			return false;
		}
	}

}



module.exports = Transmision;