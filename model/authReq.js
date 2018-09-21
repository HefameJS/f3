
const config = global.config;
const crypto = require('../util/crypto');
const FedicomError = require('./fedicomError');


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
    }

    generateJWT(includePassword) {
      return crypto.generateJWT(this, includePassword);
    }

}

module.exports = AuthReq;
