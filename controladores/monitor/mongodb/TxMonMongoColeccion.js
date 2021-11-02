'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


class DatosColeccion {


	constructor(datos) {
		this.nombre = datos.ns;

		this.bytesPorDocumento = datos.avgObjSize;

		this.bytesEnDocumentos = datos.storageSize;
		this.bytesEnIndices = datos.totalIndexSize;

		this.bytesTotal = datos.totalSize;
		this.bytesReclamables = datos.freeStorageSize;

		this.bytesSinComprimir = datos.size;

		this.numeroDocumentos = datos.count;

		this.capada = datos.capped;
		this.bytesIndices = datos.totalIndexSize;
		this.indices = Object.entries(datos.indexSizes).map(indice => {
			return { nombre: indice[0], bytes: indice[1] }
		})

	}

}


/**
 * Transmision que devuelve un token de observador
 */
class TxMonMongoColeccion extends TransmisionLigera {

	// @Override
	async operar() {

		let nombreColeccion = this.req.params.coleccion;

		if (nombreColeccion) {
			return this.#consultaColeccion(nombreColeccion);
		} else {
			return this.#consultaListaColecciones();
		}
	}

	async #consultaListaColecciones() {
		this.log.info('Solicitud del estado MongoDB [lista de colecciones]');


		try {
			let nombresColecciones = await M.db.command({ listCollections: 1, nameOnly: true })
			if (!nombresColecciones?.cursor?.firstBatch) {
				throw new Error('No se encuentra el valor de cursor.firstBatch');
			} else {
				let nombres = nombresColecciones.cursor.firstBatch.map(element => element.name);
				return new ResultadoTransmisionLigera(200, nombres);
			}
		} catch (errorMongo) {
			this.log.err('Error al obtener la lista de colecciones', errorMongo);
			return (new ErrorFedicom(errorMongo)).generarResultadoTransmision();
		}


	}

	async #consultaColeccion(nombreColeccion) {
		this.log.info(`Solicitud del estado MongoDB [coleccion=${nombreColeccion}]`);
		try {
			let datosColeccion = await M.db.command({ collStats: nombreColeccion });
			datosColeccion = new DatosColeccion(datosColeccion);
			return new ResultadoTransmisionLigera(200, datosColeccion);
		} catch (errorMongo) {
			this.log.err('Error al obtener los datos de la colección', errorMongo);
			return (new ErrorFedicom(errorMongo)).generarResultadoTransmision();
		}
	}
}


TxMonMongoColeccion.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonMongoColeccion;