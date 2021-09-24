'use strict';

/**
 * Almacén de metadatos
 */
class MetadatosOperacion {

	#metadatosOperacionSet = {}
	#metadatosOperacion = {}

	/**
	 * Inserta el metadato con el nombre/valor indicados
	 * @param {*} clave 
	 * @param {*} valor 
	 */
	insertar(clave, valor, operacion = null) {

		if (operacion) {
			if (!this.#metadatosOperacion[operacion]) this.#metadatosOperacion[operacion] = {};
			this.#metadatosOperacion[operacion][clave] = valor;
		} else {
			this.#metadatosOperacionSet[clave] = valor;
		}
	}





	/**
	 * Prepara los metadatos almacenados en el objeto y los inserta en una sentencia de update de mongodb.
	 * @param {*} sentencia 
	 */
	sentenciar(sentencia) {

		let metadatosAplanados = {};
		MetadatosOperacion.#aplanarObjetoRecursivamente(this.#metadatosOperacionSet, '', metadatosAplanados);

		if (!sentencia['$set']) sentencia['$set'] = {}

		for (const valor in metadatosAplanados) {
			if (metadatosAplanados[valor] !== null) {
				sentencia['$set'][valor] = metadatosAplanados[valor]
			}
		}

		if (Object.keys(sentencia['$set']).length === 0) {
			delete sentencia['$set'];
		}


		for (let operacion in this.#metadatosOperacion) {
			if (!sentencia[operacion]) sentencia[operacion] = {}

			for (let clave in this.#metadatosOperacion[operacion]) {
				sentencia[operacion][clave] = this.#metadatosOperacion[operacion][clave];
			}
		}


	}


	static #aplanarObjetoRecursivamente(objeto, claveBase, resultado) {

		for (let key in objeto) {
			let valor = objeto[key];

			let nombreAplanado = (claveBase ? claveBase + "." + key : key);  // joined key with dot
			if (valor && Object.getPrototypeOf(valor)?.constructor?.name === 'Object') {
				MetadatosOperacion.#aplanarObjetoRecursivamente(valor, nombreAplanado, resultado);  // es un Objecto "plano", llamamos recursivamente
			} else {
				resultado[nombreAplanado] = valor;
			}
		}
	}
}

module.exports = MetadatosOperacion;