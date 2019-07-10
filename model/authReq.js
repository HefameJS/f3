'use strict';
const BASE = global.BASE;
const config = global.config;
const Tokens = require(BASE + 'util/tokens');
const FedicomError = require(BASE + 'model/fedicomError');
const domain = require(BASE + 'model/domain');



class AuthReq {
	constructor(json, txId) {
		this.domain = domain.verify(json.domain);
		this.txId = txId

		if (this.domain === 'APIKEY') {
			if (json.user && json.apikey) {
				this.username = json.user;
				this.password = json.apikey;
			}
		} else { // ASUMIMOS QUE EL DOMINIO ES FEDICOM
			if (json.user && json.password) {
				this.username = json.user;
				this.password = json.password;
			} else {
				var error = new FedicomError();
				if (!json.user)		error.add('AUTH-003', 'El parámetro usuario es obligatorio', 400);
				if (!json.password)	error.add('AUTH-004', 'El parámetro password es obligatorio', 400);
				throw error;
			}
		}




    }

    generateJWT(includePassword) {
      return Tokens.generateJWT(this, this.txId, includePassword);
    }

}

module.exports = AuthReq;
