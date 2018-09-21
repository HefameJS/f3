'use strict';


class SapSystem {
  constructor(json) {
    this.host = json.host;
    this.port = json.port;
    this.https = json.https;
    this.username = json.username;
    this.password = json.password;
  }

  getURI(path) {
    var uri = this.https ? 'https://' : 'http://';
    uri += this.host + ':' + this.port
    if (path) uri += path;
    return uri;
  }

  getAuthHeaders() {

    var salt = Date.timestamp();
    var hashAlgo = 'MD5';
    var hashKey = require('crypto').createHash(hashAlgo).update(salt + this.password).digest('hex');

    return {
      'X-Salt': salt,
      'X-Hash': hashAlgo,
      'X-Key' : hashKey,
      'X-User': this.username
    };

  }

}

module.exports = SapSystem;
