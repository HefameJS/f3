'use strict';

/**
 * Almacén de metadatos
 */
class MetadatosOperacion {
	
	#metadatosOperacion = {}

	/**
	 * Inserta el metadato con el nombre/valor indicados
	 * @param {*} nombre 
	 * @param {*} valor 
	 */
	insertar(nombre, valor) {

		



		this.#metadatosOperacion[nombre] = valor;
	}

	/**
	 * Prepara los metadatos almacenados en el objeto y los inserta en una sentencia de update de mongodb.
	 * @param {*} sentencia 
	 */
	sentenciar(sentencia) {

		let metadatosAplanados = {};
		MetadatosOperacion.#aplanarObjetoRecursivamente(this.#metadatosOperacion, '', metadatosAplanados);

		if (!sentencia['$set']) sentencia['$set'] = {}
		
		for (const valor in metadatosAplanados) {
			if (metadatosAplanados[valor]) {
				sentencia['$set'][valor] = metadatosAplanados[valor]
			}
		}

		if (Object.keys(sentencia['$set']).length === 0) {
			delete sentencia['$set'];
		}

	}


	static #aplanarObjetoRecursivamente( objeto, claveBase, resultado ) {

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