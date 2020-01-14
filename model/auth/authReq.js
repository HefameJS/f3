'use strict';
const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const FedicomError = require(BASE + 'model/fedicomError');
const Flags = require(BASE + 'interfaces/cache/flags');



class AuthReq {
	constructor(txId, json) {
		this.domain = K.DOMINIOS.verificar(json.domain);

		if (this.domain === K.DOMINIOS.APIKEY) { // Este caso se eliminará cuando se implemente la autenticación LDAP
			if (json.user && json.apikey) {
				this.username = json.user.trim();
				this.password = json.apikey.trim();
			} else {
				var error = new FedicomError();
				if (!json.user)		error.add('AUTH-003', 'El parámetro "user" es obligatorio', 400);
				if (!json.apikey)	error.add('AUTH-Z04', 'El parámetro "apikey" es obligatorio', 400);
				throw error;
			}
		} else {
			if (json.user && json.password) {
				this.username = json.user.trim();
				this.password = json.password.trim();


				// Comprobación de si es TRANSFER o no
				if (this.username.search(/^T[RGP]/) === 0) {
					this.domain = K.DOMINIOS.TRANSFER;
					Flags.set(txId, K.FLAGS.TRANSFER);
				}

			} else {
				var error = new FedicomError();
				if (!json.user)		error.add('AUTH-003', 'El parámetro "user" es obligatorio', 400);
				if (!json.password)	error.add('AUTH-004', 'El parámetro "password" es obligatorio', 400);
				throw error;
			}
		}

		// COPIA DE PROPIEDADES
		Object.assign(this, json);
    }

	generateJWT(txId, perms) {
		return Tokens.generateJWT(txId, this, perms);
    }

}

module.exports = AuthReq;
