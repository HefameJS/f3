'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;
const M = global.mongodb;

const JsonWebToken = require('jsonwebtoken');

/**
 * Clase que representa al token recibido en una transmisión.
 * Resumen de propiedades:
 * - jwt: 
 * - 
 * - error: Indica un objeto de Error si se encuentra algún error en el tratamiento del token. undefined si no hay errores.
 * - usuario: 
 * - dominio: 
 * - permanente: 
 * - fechaDeExpiracion: 
 * - fechaDeEmision: La fecha de emision del token en un objeto Date. undefined si no aplica.
 * - transmisionDeEmision:
 * - permisos: 
 */
class Token {

	jwt = null; 				// (string) El token de la transmisión(null si no aparece)
	verificado = false;			// (bool) Indica si el token es válido o no (true|false)

	#error;						// (Errir) Indica un objeto de Error si se encuentra algún error en el tratamiento del token. undefined si no hay errores.
	#usuario;					// (string) El usuario del token. undefined si no aplica.
	#dominio;					// (string) El dominio al que pertenece el usuario del token. undefined si no aplica.
	#fechaDeExpiracion;			// (Date) La fecha de expiración del token en un objeto Date. undefined si no aplica.
	#fechaDeEmision;			// (Date) La fecha de emision del token en un objeto Date. undefined si no aplica.
	#transmisionDeEmision;		// (ObjectID) El ObjectID de la transmisión que generó el token. undefined si no aplica.
	#permanente;				// (bool) Indica si el token es permanente o no (true|false).
	#permisos;					// (Array[string]) Un array con los permisos del token.

	constructor(transmision) {

		this.#extraerToken(transmision);
		this.#verificarJwt();

	}

	get datos() {
		return {
			usuario: this.#usuario,
			dominio: this.#dominio,
			fechaDeExpiracion: this.#fechaDeExpiracion,
			fechaDeEmision: this.#fechaDeEmision,
			transmisionDeEmision: this.#transmisionDeEmision,
			permisos: this.#permisos
		};
	}

	esPermanente() {
		return this.#permanente;
	}

	/**
	 * Extrae el token de la transmisión.
	 * Tal como indica el protocolo Fedicom3, el token debe aparecer en la cabecera 'Authorization' precedido por 'Bearer '
	 * @param {Transmision} transmision 
	 */
	#extraerToken(transmision) {
		let cabeceraAutorizacion = transmision.req.headers?.authorization;
		if (cabeceraAutorizacion) {
			if (cabeceraAutorizacion.startsWith('Bearer ')) {
				this.jwt = cabeceraAutorizacion.slice(7);
			}
		}
	}

	/**
	 * Verifica y extrae los datos del token
	 * @returns 
	 */
	#verificarJwt() {

		if (!this.jwt) {
			this.#error = new Error('Usuario no autentificado');
			return;
		}

		try {

			let tokenDecodificado = JsonWebToken.verify(this.jwt, C.jwt.clave, { clockTolerance: C.jwt.tiempoDeGracia });
			this.verificado = true;

			this.#usuario = tokenDecodificado.sub;
			this.#dominio = tokenDecodificado.aud;

			// Los tokens permanentes llevan exp = 9999999999, iat = 0
			// Por error, algunos se generaron con exp = 9999999999999, iat = 1
			if (tokenDecodificado.exp >= 9999999999 && tokenDecodificado.iat <= 1) {
				this.#permanente = true;
			} else {
				this.#permanente = false;
				this.#fechaDeExpiracion = new Date();
				this.#fechaDeExpiracion.setTime(tokenDecodificado.exp * 1000);
				this.#fechaDeEmision = new Date();
				this.#fechaDeEmision.setTime(tokenDecodificado.iat * 1000);
			}

			try {
				this.#transmisionDeEmision = tokenDecodificado.jti ? new M.ObjectID(tokenDecodificado.jti) : undefined;
			} catch (errorJti) {

			}

			// Copiamos los permisos del usuario, si los hubiere
			if (Array.isArray(tokenDecodificado.perms)) {
				this.#permisos = tokenDecodificado.perms.map(permisoBruto => permisoBruto)
			}

		} catch (errorJwt) {

			this.#error = errorJwt;

		}
	}

}

module.exports = Token;