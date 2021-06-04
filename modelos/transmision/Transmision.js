'use strict';
//const C = global.config;
//const L = global.logger;
const K = global.constants;
const M = global.mongodb;


const Token = require('modelos/transmision/Token');
const MetadatosConexionEntrante = require('modelos/transmision/MetadatosConexionEntrante');
const LogTransmision = require('modelos/transmision/LogTransmision');
const IntercambioSap = require('modelos/transmision/IntercambioSap');

const iSQLite = require('interfaces/iSQLite');
const ErrorFedicom = require('modelos/ErrorFedicom');


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
	fechaCreacion;				// (Date) Fecha de creación de la transmisión.
	#estado;					// (integer) El estado de la transmisión. Ej, RECEPCIONADA, ESPERANDO FALTAS ....
	#tipo;						// (integer) El tipo de la transmisión. Ej. AUTENTICACION, CREAR PEDIDO, ....
	token;						// (Token) Datos del token transmitido en la transmisión.
	#intercambioSap				// (IntercambioSap) Interfaz de comunicación con SAP
	metadatosConexionEntrante;	// (MetadatosConexionEntrante) Metadatos de la conexión entrante.

	constructor(req, res, tipo) {
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
		this.token = new Token(this);
		this.#intercambioSap = new IntercambioSap(this);

		this.metadatosConexionEntrante = new MetadatosConexionEntrante(this);
		
	}

	/**
	 * Retorna el tipo de la transmisión.
	 */
	getTipo() {
		return this.#tipo;
	}

	/**
	 * Obtiene el objecto request de express
	 */
	get req() {
		return this.#http.req;
	}

	get sap() {
		return this.#intercambioSap;
	}



	setEstado(estado) {
		this.log.evento(`La transmisión pasa de estado ${this.#estado} a ${estado}`);
		this.#estado = estado;
	}

	/**
	 * Envía una respuesta a la solicitud HTTP del cliente.
	 * 
	 * @param {ErrorFedicom|Object} datos Los datos a enviar
	 * @param {number} codigoEstado El código de estado de la respuesta HTTP. Por defecto 200.
	 */
	async responder(datos, codigoEstado) {

		if (this.#http.res.headersSent) {
			this.log.fatal('Se está intentando enviar una respuesta HTTP por segunda vez', datos, codigoEstado);
			return;
		}

		this.#http.res.setHeader('X-TxID', this.txId);
		this.#http.res.setHeader('Software-ID', K.SOFTWARE_ID.SERVIDOR);
		this.#http.res.setHeader('Content-Api-Version', K.VERSION.PROTOCOLO);

		if (ErrorFedicom.esErrorFedicom(datos)) {
			codigoEstado = codigoEstado || datos.getCodigoRespuestaHttp();
			datos = datos.getListaErroresFedicom();
		} else {
			codigoEstado = codigoEstado || 200;
		}

		this.#http.res.datos = datos;

		try {
			let respuesta = await this.#http.res.status(codigoEstado).json(datos);
			this.log.info(`Se ha enviado una respuesta ${respuesta.statusCode} - ${respuesta.statusMessage} al cliente`);
			this.#http.respuesta.datos = datos;
			this.#http.respuesta.codigo = codigoEstado;
		} catch (errorRespuesta) {
			this.log.err('No se pudo enviar la respuesta al cliente por un error en el socket', errorRespuesta);
			this.#http.respuesta.error = errorRespuesta;
		}

		this.#http.respuesta.enviada = true;

	}

	/**
	 * Método absctrato que las clases que hereden deben implementar
	 */
	async operar() {
		this.log.fatal('Intento de operar sobre una transmisión que no tiene redefinido el método operar()')
		await this.responder(new ErrorFedicom('HTTP-ERR-500', `${__filename}@${new Error().lineNumber}`, 500));
	}

	#generarMetadatosConexion() {

		//Flag de transimision
		return {
			ip: this.metadatosConexionEntrante.ip,
			autenticacion: this.token.generarFlag(),
			programa: this.metadatosConexionEntrante.programa,
			ssl: this.metadatosConexionEntrante.ssl,
			balanceador: this.metadatosConexionEntrante.balanceador,
			concentrador: this.metadatosConexionEntrante.concentrador
		}

	}

	async registrarTransmision() {

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

	async actualizarTransmision() {

		let sentencia = {
			$setOnInsert: {
				_id: this.txId,
				fechaCreacion: this.fechaCreacion
			},
			$set: {
				estado: this.#estado,
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