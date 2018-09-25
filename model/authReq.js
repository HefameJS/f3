
const config = global.config;
const Tokens = require('../util/tokens');
const FedicomError = require('./fedicomError');
const domain = require('./domain');



class AuthReq {
    constructor(json) {
      if (json.username && json.password) {
        this.username = json.username;
        this.password = json.password;
      } else {
        var error = new FedicomError();
        if (!json.username) error.add('AUTH-003', 'El parámetro usuario es obligatorio', 400);
        if (!json.password) error.add('AUTH-004', 'El parámetro password es obligatorio', 400);
        throw error;
      }

      this.domain = domain.verify(json.domain);
      if (this.domain === false) {
        throw new FedicomError('AUTH-Z01', 'El dominio no existe', 401);
      }

    }

    generateJWT(includePassword) {
      return Tokens.generateJWT(this, includePassword);
    }

}

module.exports = AuthReq;
