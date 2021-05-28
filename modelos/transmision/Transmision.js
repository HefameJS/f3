'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
const M = global.mongodb;


const Token = require('./Token');
const MetadatosConexionEntrante = require('./MetadatosConexionEntrante');
const LogTransmision = require('./LogTransmision');


/**
 * Representación de la transmisión que se está procesando en el concentrador.
 * La clase permite conocer y manejar el flujo y ciclo de vida de cada transmisión.
 */
class Transmision extends Object {

	// Contiene la peticion y respuesta de Express {req, res}
	#http;


	txId;						// (ObjectID) El ID único de la transmisión.
	fechaCreacion;				// (Date) Fecha de creación de la transmisión.
	estado;						// (integer) El estado de la transmisión. Ej, RECEPCIONADA, ESPERANDO FALTAS ....
	#tipo;						// (integer) El tipo de la transmisión. Ej. AUTENTICACION, CREAR PEDIDO, ....
	token;						// (Token) Datos del token transmitido en la transmisión.
	metadatosConexionEntrante;	// (MetadatosConexionEntrante) Metadatos de la conexión entrante.

	constructor(req, res) {
		super();

		this.txId = new M.ObjectID();
		this.fechaCreacion = new Date();
		this.estado = Transmision.ESTADOS.RECEPCIONADO;

		this.log = new LogTransmision();

		this.#http = { req, res };
		this.token = new Token(this);

		this.metadatosConexionEntrante = new MetadatosConexionEntrante(this);


		/*
		res.setHeader('X-TxID', txId);
		res.setHeader('Software-ID', C.softwareId.servidor);
		res.setHeader('Content-Api-Version', K.VERSION.PROTOCOLO);
		*/

	}

	/**
	 * Establece el tipo de la transmision. El tipo solo se puede establecer una vez.
	 * @param {*} tipoTransmision 
	 */
	set tipo(tipoTransmision) {
		if (!this.#tipo) {
			this.#tipo = tipoTransmision;
		} else {
			this.log.err('Se intenta establecer el tipo de la transmisión mas de una vez');
		}
	}

	/**
	 * Retorna el tipo de la transmisión.
	 */
	get tipo() {
		return this.#tipo;
	}


	registrarInicioTransmision


	/**
	 * Obtiene el objecto request de express
	 */
	get req() {
		return this.#http.req;
	}

}




Transmision.ESTADOS = {
	RECEPCIONADO: 1010
}


Transmision.TIPOS = {
	AUTENTICACION: 0
}



module.exports = Transmision;