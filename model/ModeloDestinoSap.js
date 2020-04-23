'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;

//Externas
const crypto = require('crypto');

class DestinoSap {
  constructor(json) {
    this.host = json.host;
    this.port = json.port;
    this.https = json.https;
    this.username = json.username;
    this.password = json.password;
    this.prefix = json.prefix || '';

    this.prefijoRuta = (this.https ? 'https://' : 'http://') + this.host + ':' + this.port + this.prefix
  }

  construirUrl(ruta) {
    if (ruta) return this.prefijoRuta + ruta;
    return this.prefijoRuta;
  }

  generarCabeceras() {

    let salt = Date.fedicomTimestamp();
    let hashAlgo = 'MD5';
    let hashKey = crypto.createHash(hashAlgo).update(salt + this.password).digest('hex');

    return {
      'X-Salt': salt,
      'X-Hash': hashAlgo,
      'X-Key' : hashKey,
      'X-User': this.username
    };

  }

  /**
   * Crea un objeto de parámetros listo para ser pasado a la librería 'request' para que haga
   * la llamada al sistema SAP.
   * 
   * Las opciones que admite son:
   *    path: La ruta del servidor SAP a la que acceder. Notese que a este valor se le concatena el nombre del servidor,
   *          el protocolo, puerto, etc.. necesarios para acceder al sistema definido en la instancia.
   *          Por ejemplo:
   *            - path = /gonorrea, acabará de la forma -> https://sap.hefame.es:8443/api/gonorrea
   *    body: El cuerpo del mensaje a enviar. Espera que sea un objeto JSON. Este interfaz solo soporta el envío de JSON.
   *    method: El método HTTP a usar. Si no se especifica y SI se especifica la opción 'body', se usará el metodo POST,
   *          si NO se especifica la opción 'body', se usará el método GET.
   * 
   * @param {*} opciones 
   */
  obtenerParametrosLlamada(opciones) {
    return {
      followAllRedirects: true,
      json: true,
      url: this.construirUrl(opciones.path || ''),
      method: opciones.method ? opciones.method : (opciones.body ? 'POST' : 'GET'),
      headers: this.generarCabeceras(),
      body: opciones.body ? opciones.body : undefined,
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
  let datosConfiguracion = nombreSistemaSap ? C.sistemaSap(nombreSistemaSap) : C.sistemaSapPorDefecto();
  if (!datosConfiguracion) {
    return null;
  }
  return new DestinoSap(datosConfiguracion);
}


DestinoSap.porDefecto = () => {
  let datosConfiguracion = C.sistemaSapPorDefecto();
  if (!datosConfiguracion) {
    return null;
  }
  return new DestinoSap(datosConfiguracion);
}

module.exports = DestinoSap;
