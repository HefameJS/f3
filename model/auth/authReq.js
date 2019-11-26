'use strict';
const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const FedicomError = require(BASE + 'model/fedicomError');
const Domain = require(BASE + 'model/auth/domain');



class AuthReq {
	constructor(json) {
		this.domain = Domain.verify(json.domain);

		if (this.domain === Domain.domains.apikey) {
			if (json.user && json.apikey) {
				this.username = json.user.trim();
				this.password = json.apikey.trim();
			} else {
				var error = new FedicomError();
				if (!json.user)		error.add('AUTH-003', 'El parámetro "user" es obligatorio', 400);
				if (!json.apikey)		error.add('AUTH-Z04', 'El parámetro "apikey" es obligatorio', 400);
				throw error;
			}
		} else { // ASUMIMOS QUE ES UNA AUTENTICACION FEDICOM O TRANSFER
			if (json.user && json.password) {
				this.username = json.user.trim();
				this.password = json.password.trim();

				// Comprobación de si es TRANSFER o no
				if (this.username.startsWith('TR') || this.username.startsWith('TG') || this.username.startsWith('TP')) {
					this.domain = Domain.domains.transfer;
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

	generateJWT(txId) {
      return Tokens.generateJWT(this, txId, false);
    }

}

module.exports = AuthReq;
