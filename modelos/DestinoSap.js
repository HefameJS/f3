'use strict';
let C = global.config;
//const L = global.logger;
//const K = global.constants;

//Externas
const crypto = require('crypto');
const { resourceUsage } = require('process');

class DestinoSap {
	constructor(json) {
		this.id = json.id;
		this.servidor = json.servidor;
		this.puerto = json.puerto;
		this.https = json.https;
		this.usuario = json.usuario;
		this.password = json.password;
		this.prefijo = json.prefijo || '';
		this.urlBase = (this.https ? 'https://' : 'http://') + this.servidor + ':' + this.puerto + this.prefijo
	}

	construirUrl(ruta) {
		if (ruta) return this.urlBase + ruta;
		return this.urlBase;
	}

	generarCabeceras() {

		let salt = Date.fedicomTimestamp();
		let hashAlgo = 'MD5';
		let hashKey = crypto.createHash(hashAlgo).update(salt + this.password).digest('hex');

		return {
			'X-Salt': salt,
			'X-Hash': hashAlgo,
			'X-Key': hashKey,
			'X-User': this.usuario
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
	obtenerParametrosLlamada({method, body, url, ...opciones }) {

		return {
			...opciones,
			method: method ? method : (body ? 'POST' : 'GET'),
			headers: this.generarCabeceras(),
			data: body ? body : undefined,
			responseType: 'json',
			responseEncoding: 'latin1',
			url: this.construirUrl(url),
			validateStatus: (status) => true // Hace que AXIOS resuelva siempre las llamadas aunque SAP de errores 4xx, 5xx, etc ...
		};
	}


	/**
	 * Devuelve una copia de los datos del sistema, donde se elimina información sensible.
	 * Para motivos de monitorizacion únicamente.
	 */
	describirSistema() {
		return {
			id: this.id,
			servidor: this.servidor,
			puerto: this.puerto,
			https: this.https,
			prefijo: this.prefijo,
			urlBase: this.urlBase
		}
	}

}

module.exports = DestinoSap;
