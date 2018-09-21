
const config = global.config;
const crypto = require('../util/crypto');


class AuthReq {
    constructor(json) {
        this.username = json.username;
        this.password = json.password;
    }

    generateJWT(includePassword) {
      return crypto.generateJWT(this, includePassword);
    }

}

module.exports = AuthReq;
