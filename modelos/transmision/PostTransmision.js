'use strict';
//const C = global.config;
const K = global.constants;
const M = global.mongodb;


const LogTransmision = require('modelos/transmision/LogTransmision');
const MetadatosOperacion = require('modelos/transmision/MetadatosOperacion');

/**
 * Clase que representa a una transmisión que ya está registrada en la base de datos.
 * Permite operar/consultar a posteriori sobre transmisiones.
 * Las operaciones permitidas son con el estado y con los metadatos
 */
class PostTransmision {

	txId;							// (ObjectID) El ID único de la transmisión.
	log;							// (LogTransmision) El gestor de log para esta transmisión.

	#datosTransmision = null;		// (Object) Contiene los datos de la transmisión recuperada de la base de datos.
	#metadatosOperacion;		// (MetadatosOperacion) Objeto en el que se manejan los metadatos de la operación llevada a cabo en esta transmision.

	/**
	 * Instancia un objeto de post-transmisión que coincida con la consulta que el indiquemos.
	 * 
	 * @param {*} consulta 
	 * @returns 
	 */
	static async instanciar(consulta) {
		try {
			let datosTransmision = await M.col.transmisiones.findOne(consulta, { projection: { conexion: 0, sap: 0 } });
			if (datosTransmision?._id) {
				return new PostTransmision(datosTransmision);
			} else {
				throw new Error('No se encuentra ninguna transmisión con el filtro indicado.');
			}
		} catch (errorMongo) {
			throw errorMongo;
		}

	}
	constructor(datosTransmision) {

		this.txId = datosTransmision._id;
		this.#datosTransmision = datosTransmision;

		this.log = new LogTransmision(this, this.txId.toString());
		this.log.info(`Se re-instancia la transmisión ${this.#datosTransmision._id}`);

		this.#metadatosOperacion = new MetadatosOperacion();
	}

	/**
	   * Establece el estado de la transmision
	   * @param {*} estado El nuevo estado
	   */
	setEstado(estado) {
		this.log.evento(`Se establece el estado de la transmisión de ${this.#datosTransmision.estado} a ${estado}`);
		this.#datosTransmision.estado = estado;
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

	async actualizarTransmision() {

		let sentencia = {
			$setOnInsert: {
				_id: this.txId,
			},
			$max: {
				estado: this.#datosTransmision.estado,
			}
		}


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

module.exports = PostTransmision;