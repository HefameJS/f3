'use strict';
//const BASE = global.BASE;
const C = global.config;
//const L = global.logger;
//const K = global.constants;

const Crypto = require('crypto');

class DestinoSap {
  constructor(json) {
    this.host = json.host;
    this.port = json.port;
    this.https = json.https;
    this.username = json.username;
    this.password = json.password;
    this.prefix = json.prefix || '';

    this.preCalculatedBaseUrl = (this.https ? 'https://' : 'http://') + this.host + ':' + this.port + this.prefix
  }

  construirUrl(path) {
    if (path) return this.preCalculatedBaseUrl + path;
    return this.preCalculatedBaseUrl;
  }

  generarCabeceras() {

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

  obtenerParametrosLlamada(params) {
    return {
      followAllRedirects: true,
      json: true,
      url: this.construirUrl(params.path || ''),
      method: params.method ? params.method : (params.body ? 'POST' : 'GET'),
      headers: this.generarCabeceras(),
      body: params.body ? params.body : undefined,
      encoding: 'latin1'
    };
  }

}

/**
 * Trata de crear el objeto del destino SAP en base al nombre del mismo.
 * Si no se especifica el nombre, se usa el sistema SAP por defecto.
 * En caso de que el sistema SAP no exista, se devuelve null.
 * Si el sistema SAP es correcto, se devuelve el objeto SapSystem
 *
 * @param {*} sapSystemName
 * @param {*} callback
 */
DestinoSap.desdeNombre = (nombreSistemaSap) => {
  let datosConfiguracion = nombreSistemaSap ? C.getSapSystem(nombreSistemaSap) : C.getDefaultSapSystem();
  if (!datosConfiguracion) {
    return null;
  }
  return new DestinoSap(datosConfiguracion);
}


DestinoSap.porDefecto = () => {
  let datosConfiguracion = C.getDefaultSapSystem();
  if (!datosConfiguracion) {
    return null;
  }
  return new DestinoSap(datosConfiguracion);
}

module.exports = DestinoSap;
