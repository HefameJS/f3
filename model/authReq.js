'use strict';
const BASE = global.BASE;
const config = global.config;
const Tokens = require(BASE + 'util/tokens');
const FedicomError = require(BASE + 'model/fedicomError');
const domain = require(BASE + 'model/domain');



class AuthReq {
    constructor(json, txId) {
      if (json.user && json.password) {
        this.username = json.user;
        this.password = json.password;
		  this.txId = txId
      } else {
        var error = new FedicomError();
        if (!json.user) error.add('AUTH-003', 'El parámetro usuario es obligatorio', 400);
        if (!json.password) error.add('AUTH-004', 'El parámetro password es obligatorio', 400);
        throw error;
      }

      this.domain = domain.verify(json.domain);
      if (this.domain === false) {
        throw new FedicomError('AUTH-Z01', 'El dominio no existe', 401);
      }

    }

    generateJWT(includePassword) {
      return Tokens.generateJWT(this, this.txId, includePassword);
    }

}

module.exports = AuthReq;
