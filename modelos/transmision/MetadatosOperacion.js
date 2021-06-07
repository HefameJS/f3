'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;



class MetadatosOperacion {
	
	#metadatosOperacion = {

	};

	insertar(nombre, valor) {
		this.#metadatosOperacion[nombre] = valor;
	}

	sentenciar(sentencia) {

		for (const valor in this.#metadatosOperacion) {
			if (this.#metadatosOperacion[valor]) {
				sentencia['$set'][valor] = this.#metadatosOperacion[valor]
			}
		}

	}
}

module.exports = MetadatosOperacion;