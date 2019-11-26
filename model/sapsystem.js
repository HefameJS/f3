'use strict';
//const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

const Crypto = require('crypto');

class SapSystem {
  constructor(json) {
    this.host = json.host;
    this.port = json.port;
    this.https = json.https;
    this.username = json.username;
    this.password = json.password;
    this.prefix = json.prefix || '';

    this.preCalculatedBaseUrl = (this.https ? 'https://' : 'http://') + this.host + ':' + this.port + this.prefix
  }

  getURI(path) {
    if (path) return this.preCalculatedBaseUrl + path;
    return this.preCalculatedBaseUrl;
  }

  getAuthHeaders() {

    var salt = Date.fedicomTimestamp();
    var hashAlgo = 'MD5';
    var hashKey = Crypto.createHash(hashAlgo).update(salt + this.password).digest('hex');

    return {
      'X-Salt': salt,
      'X-Hash': hashAlgo,
      'X-Key' : hashKey,
      'X-User': this.username
    };

  }

  getRequestCallParams(params) {
    return {
      followAllRedirects: true,
      json: true,
      url: this.getURI(params.path || ''),
      method: params.method ? params.method : (params.body ? 'POST' : 'GET'),
      headers: this.getAuthHeaders(),
      body: params.body ? params.body : undefined,
      encoding: 'latin1'
    };
  }

}

module.exports = SapSystem;
