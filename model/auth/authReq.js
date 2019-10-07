'use strict';
const BASE = global.BASE;
const config = global.config;
const Tokens = require(BASE + 'util/tokens');
const FedicomError = require(BASE + 'model/fedicomError');
const domain = require(BASE + 'model/auth/domain');



class AuthReq {
	constructor(json, txId) {
		this.domain = domain.verify(json.domain);
		this.txId = txId

		if (this.domain === 'APIKEY') {
			if (json.user && json.apikey) {
				this.username = json.user.trim();
				this.password = json.apikey.trim();
			} else {
				var error = new FedicomError();
				if (!json.user)		error.add('AUTH-003', 'El parámetro "user" es obligatorio', 400);
				if (!json.apikey)		error.add('AUTH-Z04', 'El parámetro "apikey" es obligatorio', 400);
				throw error;
			}
		} else { // ASUMIMOS QUE EL DOMINIO ES FEDICOM
			if (json.user && json.password) {
				this.username = json.user.trim();
				this.password = json.password.trim();
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

    generateJWT(includePassword) {
      return Tokens.generateJWT(this, this.txId, includePassword);
    }

}

module.exports = AuthReq;
