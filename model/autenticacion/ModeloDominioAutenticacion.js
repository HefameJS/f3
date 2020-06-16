'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;



class DominioAutenticacion {

	constructor(txId, nombreDominio) {
		this.dominio = K.DOMINIOS.FEDICOM;

		if (!nombreDominio) return;

		L.xw(txId, ['Se especifica el nombre de dominio en la peticion', nombreDominio]);

		// En el caso especial de que se especifique el dominio TRANSFER, dejaremos que el dominio sea FEDICOM.
		// El decidir si el dominio es transfer o no depende del nombre del usuario que vaya en la solicitud, el usuario no
		// puede especificarlo a mano.
		if (nombreDominio === K.DOMINIOS.TRANSFER) return;

		for (let idDominio in K.DOMINIOS) {

			if (K.DOMINIOS[idDominio] && K.DOMINIOS[idDominio].toUpperCase() === nombreDominio.toUpperCase()) {
				this.dominio = K.DOMINIOS[idDominio];
				return;
			}

		}

		L.xw(txId, ['No se encuentra el dominio especificado, se utiliza el domino por defecto', nombreDominio]);

	}


	static nombreDominioValidado(txId, nombreDominio) {
		return (new DominioAutenticacion(txId, nombreDominio)).dominio;
	}

}

module.exports = DominioAutenticacion;