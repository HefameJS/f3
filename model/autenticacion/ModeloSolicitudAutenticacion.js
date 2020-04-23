'use strict';
//const C = global.config;
//const L = global.logger;
const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iFlags = require('interfaces/iFlags');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');


/**
 * Parametros obligatorios:
 * 	- user
 * 	- password
 * 
 * Parámetros adicionales:
 * 	- domain - Indica el dominio de autenticación del usuario. Por defecto se usa FEDICOM o TRANSFER
 *  - noCache - Indica que la comprobación de las credenciales no se haga nunca en cache, ni se cachee la respuesta
 *  - debug - La respuesta incluirá la información del token en formato legible
 *  - sapSystem - Fuerza el desvío de la petición al sistema SAP indicado
 */
class SolicitudAutenticacion {

	constructor(txId, json) {

		this.domain = K.DOMINIOS.verificar(json.domain);

		if (json.user && json.password) {
			this.username = json.user.trim();
			this.password = json.password.trim();

			// Comprobación de si es TRANSFER o no
			// en funcion de si el nombre del usuario empieza por TR, TG o TP
			if (this.username.search(/^T[RGP]/) === 0) {
				this.domain = K.DOMINIOS.TRANSFER;
				iFlags.set(txId, K.FLAGS.TRANSFER);
			}

		} else {
			let errorFedicom = new ErrorFedicom();
			if (!json.user) errorFedicom.add('AUTH-003', 'El parámetro "user" es obligatorio', 400);
			if (!json.password) errorFedicom.add('AUTH-004', 'El parámetro "password" es obligatorio', 400);
			throw errorFedicom;
		}


		// COPIA DE PROPIEDADES
		Object.assign(this, json);
	}

	generarToken(txId, perms) {
		return iTokens.generarToken(txId, this, perms);
	}

}

module.exports = SolicitudAutenticacion;
