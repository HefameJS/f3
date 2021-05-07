'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iTokens = require('global/tokens');
const iFlags = require('interfaces/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

// Util
const Validador = require('global/validador');

/**
 * Parametros obligatorios:
 * 	- user
 * 	- password
 * 
 * Parámetros adicionales:
 * 	- domain - Indica el dominio de autenticación del usuario. Por defecto se usa FEDICOM o TRANSFER
 *  - noCache - Indica que la comprobación de las credenciales no se haga nunca en cache, ni se cachee la respuesta
 *  - debug - La respuesta incluirá la información del token en formato legible
 */
class SolicitudAutenticacion {

	constructor(req) {

		this.txId = req.txId;
		let json = req.body;

		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.user, errorFedicom, 'AUTH-003', 'El parámetro "user" es obligatorio');
		Validador.esCadenaNoVacia(json.password, errorFedicom, 'AUTH-004', 'El parámetro "password" es obligatorio');

		if (errorFedicom.tieneErrores()) {
			L.xw(this.txId, ['La autenticación contiene errores. Se aborta el procesamiento de la misma', errorFedicom]);
			throw errorFedicom;
		}

		this.usuario = json.user.trim();
		this.clave = json.password.trim();
		this.dominio = C.dominios.resolver(json.domain);
		L.xd(this.txId, ['Nombre de dominio resuelto', this.dominio]);


		// Comprobación de si es TRANSFER o no en funcion de si el nombre del usuario empieza por TR, TG o TP
		// Pero OJO, porque si empieza por T pero no es ninguno de los anteriores, SAP igualmente lo da como bueno
		// y se genera un token en el dominio FEDICOM para el usuario TRANSFER.
		// Notese que si el dominio de la solicitud no es FEDICOM, esto no aplica (Por ejemplo, dominio HEFAME).
		if (this.esTransfer()) {
			this.dominio = C.dominios.TRANSFER;
			iFlags.set(this.txId, C.flags.TRANSFER);
		}


		// Copia de propiedades no estandard
		// noCache - Indica si la autenticación debe evitar siempre la búsqueda en caché
		if (json.noCache) this.noCache = Boolean(json.noCache);

		// debug - Indica si la respuesta a la petición debe incluir los datos del token en crudo
		if (json.debug) this.debug = Boolean(json.debug);

	}

	/**
	 * La solicitud es transfer si se cumple una de
	 *  - El dominio es TRANSFER
	 *  - El dominio es FEDICOM y el nombre del usuario cumple la expresión regular /^T[RGP]/
	 */
	esTransfer() {
		return this.dominio === C.dominios.TRANSFER || (this.dominio === C.dominios.FEDICOM && this.usuario.search(/^T[RGP]/) !== -1);
	}

	generarJSON() {
		return {
			domain: this.dominio,
			username: this.usuario,
			password: this.clave
		}
	}
	
	generarToken(permisos) {
		return iTokens.generarToken(this.txId, this, permisos);
	}

	generarRespuestaToken(grupos) {
		let token = this.generarToken(grupos);
		let cuerpoRespuesta = { auth_token: token };
		if (this.debug) cuerpoRespuesta.data = iTokens.verificarToken(token);
		return cuerpoRespuesta;
	}

}

module.exports = SolicitudAutenticacion;
