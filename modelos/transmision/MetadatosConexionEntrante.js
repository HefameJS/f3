'use strict';
const K = global.K;


/**
 * Clase que representa los metadatos de una transmisión HTTP entrante
 */
class MetadatosConexionEntrante {

	ip;
	programa;
	ssl;
	balanceador;
	concentrador;

	constructor(transmision) {

		let req = transmision.req;

		this.ip = this.#obtenerDireccionIp(req);
		this.programa = this.#identificarProgramaFarmacia(req);
		this.ssl = this.#obtenerDatosSSL(req);
		this.balanceador = this.#obtenerNombreBalanceador(req);
		this.concentrador = this.#obtenerDatosConcentrador(req);
	}



	/**
	 * Obtiene y normaliza la dirección IP origen de la transmisión
	 * @param {*} req 
	 */
	#obtenerDireccionIp(req) {
		let ip = req.ip;

		if (req.headers) {
			if (req.headers['x-ip-cliente'])
				ip = req.headers['x-ip-cliente'];
			else if (req.headers['x-forwarded-for'])
				ip = req.headers['x-forwarded-for'];
		}

		if (ip === '::1')
			return '127.0.0.1'

		if (ip?.startsWith?.('::ffff:'))
			return ip.slice(7, ip.length);

		return ip;
	}

	/**
	 * Identifica el código del programa de farmacia que realiza la transmisión y lo devuelve normalizado.
	 * @param {*} req 
	 * @returns 
	 */
	#identificarProgramaFarmacia(req) {
		if (req.headers?.['software-id'])
			return parseInt(req.headers?.['software-id']) || null;
		return null;
	}


	/**
	 * Obtiene la configuración SSL de la conexión entrante
	 * @param {*} req 
	 * @returns 
	 */
	#obtenerDatosSSL(req) {

		let tmp = {
			protocoloSSL: null,
			suiteSSL: null
		}

		if (req.headers?.['x-ssl-protocol']) tmp.protocoloSSL = req.headers['x-ssl-protocol'];
		if (req.headers?.['x-ssl-cipher']) tmp.suiteSSL = req.headers['x-ssl-cipher'];

		return tmp;
	}

	/**
	 * Obtiene el nombre del balanceador de carga que recogió la petición, si existe.
	 * @param {} req 
	 * @returns 
	 */
	#obtenerNombreBalanceador(req) {
		return req.headers?.['x-balanceador']?.toLowerCase?.() || null;
	}

	/**
	 * Obtiene los datos del balanceador que procesa la conexión.
	 * @returns 
	 */
	#obtenerDatosConcentrador() {
		return {
			servidor: K.HOSTNAME,
			pid: process.pid,
			version: K.VERSION.SERVIDOR,
			git: K.VERSION.GIT
		}
	}

}

module.exports = MetadatosConexionEntrante;