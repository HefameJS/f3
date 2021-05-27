'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iTokens = require('global/tokens');
const iSap = require('interfaces/isap/iSap');
const iLdap = require('interfaces/iLdap');
const iCacheCredencialesSap = require('interfaces/isap/iCacheCredencialesSap');

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

		this.metadatos = {
			aciertoCache: false,
			evitarCache: false,
			debug: false
		}

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
		}

		// Copia de propiedades no estandard
		// noCache - Indica si la autenticación debe evitar siempre la búsqueda en caché
		if (json.noCache) this.metadatos.evitarCache = Boolean(json.noCache);

		// debug - Indica si la respuesta a la petición debe incluir los datos del token en crudo
		if (json.debug) this.metadatos.debug = Boolean(json.debug);

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
	
	async validarCredenciales() {
		switch (this.dominio) {
			case C.dominios.FEDICOM:
			case C.dominios.TRANSFER:
				// Las peticiones a los dominios FEDICOM y TRANSFER se verifican contra SAP
				return await this.#autenticarContraSAP();
			case C.dominios.HEFAME:
				// Las peticiones al dominio HEFAME se verifica contra el LDAP
				return await this.#autenticarContraLDAP();
				return;
			default: {
				// Las peticiones de otros dominios no son legales
				L.xw(this.txId, ['No se permite la expedición de tokens para el dominio', solicitudAutenticacion.dominio]);
				return {
					tokenGenerado: false,
					respuesta: new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401),
					codigoEstado: 401,
					estadoTransmision: K.TX_STATUS.FALLO_AUTENTICACION
				}
			}
		}
	}

	async #autenticarContraSAP() {

		// Comprobacion de si la credencial del usuario se encuenta en la caché
		if (!this.metadatos.evitarCache) {
			let resultadoCache = iCacheCredencialesSap.chequearSolicitud(this);
			if (resultadoCache) {
				L.xi(this.txId, 'Se produjo un acierto de caché en la credencial de usuario');
				this.metadatos.aciertoCache = true;
				return {
					tokenGenerado: true,
					respuesta: this.generarRespuestaToken(),
					codigoEstado: 201,
					estadoTransmision: K.TX_STATUS.OK
				}
			}
		}

		L.xi(this.txId, ['Se procede a comprobar en SAP las credenciales de la petición']);

		try {
			let respuestaSap = await iSap.autenticacion.verificarCredenciales(this);

			// Si el mensaje de SAP contiene el parámetro 'username', es que las credenciales son correctas.
			// de lo contrario, es que son incorrectas.
			if (respuestaSap.username) {

				// Guardamos la entrada en caché
				if (!this.metadatos.evitarCache) {
					iCacheCredencialesSap.agregarEntrada(this);
				}

				return {
					tokenGenerado: true,
					respuesta: this.generarRespuestaToken(),
					codigoEstado: 201,
					estadoTransmision: K.TX_STATUS.OK
				}

			} else {
				return {
					tokenGenerado: false,
					respuesta: new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401),
					codigoEstado: 401,
					estadoTransmision: K.TX_STATUS.FALLO_AUTENTICACION
				}
			}

		} catch (errorLlamadaSap) {
			L.xe(this.txId, ['Ocurrió un error en la llamada a SAP - Se genera token no verificado', errorLlamadaSap]);

			return {
				tokenGenerado: true,
				respuesta: this.generarRespuestaToken(),
				codigoEstado: 201,
				estadoTransmision: K.TX_STATUS.ERROR_RESPUESTA_SAP
			}
		}

	}

	async #autenticarContraLDAP() {
		L.xi(this.txId, ['Se procede a comprobar en Active Directory las credenciales de la petición']);

		try {
			let grupos = await iLdap.autenticar(this);
			L.xt(this.txId, ['Usuario validado por LDAP, grupos obtenidos', grupos]);
			return {
				tokenGenerado: true,
				respuesta: this.generarRespuestaToken(grupos),
				codigoEstado: 201,
				estadoTransmision: K.TX_STATUS.OK
			}

		} catch (errorLdap) {
			L.xe(this.txId, ['La autenticación LDAP no fue satisfatoria. No se genera token', errorLdap]);
			return {
				tokenGenerado: false,
				respuesta: new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401),
				codigoEstado: 401,
				estadoTransmision: K.TX_STATUS.FALLO_AUTENTICACION
			}
		}

	}

	generarToken(permisos) {
		return iTokens.generarToken(this.txId, this, permisos);
	}

	generarRespuestaToken(grupos) {
		let token = this.generarToken(grupos);
		let cuerpoRespuesta = { auth_token: token };
		if (this.metadatos.debug) cuerpoRespuesta.data = iTokens.verificarToken(token);
		return cuerpoRespuesta;
	}

}

module.exports = SolicitudAutenticacion;
