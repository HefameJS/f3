'use strict';
const L = global.L;

const uuid = require('uuid').v4;


const Token = require('./Token');
const ErrorFedicom = require('modelos/ErrorFedicom');
const ResultadoTransmisionLigera = require('./ResultadoTransmisionLigera');


/**
 * Representación de la transmisión que se está procesando en el concentrador.
 * Es como la clase Transmision, pero mucho mas ligera y no orientada a transmisiones que
 * son tratadas como transacciones, como pedidos/devoluciones etc...
 */
class TransmisionLigera extends Object {

	#http;						// Contiene la peticion y respuesta de Express {req, res}
	txId;						// (ObjectID) El ID único de la transmisión.
	log;						// (Log) El gestor de log para esta transmisión.
	token;						// (Token) Datos del token transmitido en la transmisión.

	static async ejecutar(req, res, ClaseTransmision, datosDeOperacion) {

		// Instancia la transmisión (notese que las transmisiones NO DEBEN sobreescribir el constructor por defecto)
		let transmision = new ClaseTransmision(req, res, ClaseTransmision.CONDICIONES_AUTORIZACION);

		// Comprobación de que el usuario pueda ejecutar la transmisión.
		let ejecucionAutorizada = await transmision.#chequeoAutorizacion()
		if (ejecucionAutorizada) {
			try {
				// Ejecuta la operacion ( metodo operar() que debe sobreescribirse ), de debe devolver un objeto de tipo ResultadoOperacion
				let resultadoOperacion = await transmision.operar(datosDeOperacion);
				// Responde al cliente HTTP y establece el estado de la transmisión
				await resultadoOperacion.responderTransmision(transmision);
				// Genera los metadatos de la transmisión
			} catch (truenoTransmision) {
				// En caso de fallo, generamos un DUMP!
				await transmision.log.dump(truenoTransmision);
				transmision.log.fatal(truenoTransmision.stack)

				// Mandamos un mensaje de error generico si no se ha enviado nada al cliente
				if (!transmision.res.headersSent) {
					try {
						let errorGenerico = new ErrorFedicom('HTTP-500', 'Error interno del servidor', 500);
						await errorGenerico.generarResultadoTransmision().responderTransmision(transmision)
					} catch (errorEnvioError) {
						L.fatal('Hasta el envío del mensaje de error genérico falla', errorEnvioError)
					}
				}

			}
		}

		return transmision;
	}

	constructor(req, res, condicionesAutorizacion) {
		super();

		this.txId = uuid();
		this.log = L.instanciar(this, 'TransmisionLigera');
		this.log.evento(`------------------------ ${this.txId} ------------------------`);
		this.log.evento(`Se da entrada a la transmisión ligera: ${this.constructor.name}`);

		this.#http = {
			req,
			res
		};
		this.token = new Token(this, condicionesAutorizacion);
	}


	/**
	 * Método abstracto que las clases que hereden deben implementar.
	 * DEBE DEVOLVER UN OBJETO ResultadoTransmision.
	 */
	async operar() {
		this.log.fatal('Intento de operar sobre una transmisión que no tiene redefinido el método operar()')
		return (new ErrorFedicom('HTTP-503', 'Transmisión sin método operar', 503)).generarResultadoTransmision();
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
	 * Metodo para que TransmisionLigera pueda pasar como Transmision normal.
	 * Realmente la transmision ligera no tiene estado.
	 */
	setEstado() {
		// SIN OPERACION
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

		} catch (errorRespuesta) {
			this.log.err('No se pudo enviar la respuesta al cliente por un error en el socket', errorRespuesta);
		}

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
			let resultadoTransmision = new ResultadoTransmisionLigera(codigoRespuesta, errorToken.getErrores())
			await resultadoTransmision.responderTransmision(this);
			return false;
		}

		return true;

	}


}



module.exports = TransmisionLigera;