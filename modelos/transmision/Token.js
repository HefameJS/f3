'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;
const M = global.mongodb;

const JsonWebToken = require('jsonwebtoken');
const CondicionesAutorizacion = require('./CondicionesAutorizacion');

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

	#transmision;				// Referencia a la transmision
	#log;						// Referencia a #transmision.log
	jwt = null; 				// (string) El token de la transmisión(null si no aparece)
	verificado = false;			// (bool) Indica si el token es válido o no (true|false)
	autorizado = false;			// (bool) Indica si el token ha sido autorizado a realizar la acción
	#condicionesAutorizacion;	// (CondicionesAutorizacion) Objeto con las condiciones que la transmision debe cumplir para que se autorice.

	#error;						// (Errir) Indica un objeto de Error si se encuentra algún error en el tratamiento del token. undefined si no hay errores.
	#usuario;					// (string) El usuario del token. undefined si no aplica.
	#dominio;					// (string) El dominio al que pertenece el usuario del token. undefined si no aplica.
	#fechaDeExpiracion;			// (Date) La fecha de expiración del token en un objeto Date. undefined si no aplica.
	#fechaDeEmision;			// (Date) La fecha de emision del token en un objeto Date. undefined si no aplica.
	#transmisionDeEmision;		// (ObjectID) El ObjectID de la transmisión que generó el token. undefined si no aplica.
	#permanente;				// (bool) Indica si el token es permanente o no (true|false).
	#permisos;					// (Array[string]) Un array con los permisos del token.

	constructor(transmision, condicionesAutorizacion) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;

		this.#condicionesAutorizacion = condicionesAutorizacion || new CondicionesAutorizacion();

		this.#extraerToken();
		this.#verificarJwt();
		this.#comprobarAutorizacion();

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

	getDatosLoginSap() {
		return {
			user: this.#usuario,
			domain: this.#dominio
		}
	}

	esPermanente() {
		return this.#permanente;
	}

	generarFlag() {
		if (this.verificado) {
			return {
				usuario: this.#usuario,
				dominio: this.#dominio
			}
		}
		return null
	}

	/**
	 * Extrae el token de la transmisión.
	 * Tal como indica el protocolo Fedicom3, el token debe aparecer en la cabecera 'Authorization' precedido por 'Bearer '
	 * @param {Transmision} transmision 
	 */
	#extraerToken() {
		let cabeceraAutorizacion = this.#transmision.req.headers?.authorization;
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

	/**
	 * Funcion que verifica los permisos del token de una petición entrante para comprobar si
	 * cumple con los requisitos establecidos en las CondicionesAutorizacion.
	 */
	#comprobarAutorizacion() {


		this.#log.debug('Realizando control de autorización', this.#condicionesAutorizacion)

		// Primerísimo de todo, el token debe ser válido
		if (!this.verificado) {
			this.autorizado = false;
			this.#log.warn('El token de la transmisión no es válido', this.#error);
			return;
		}

		return;

		/*
		// El dominio 'INTERFEDICOM' solo se permite en llamadas al proceso de monitor, nunca al core
		if (req.token.aud === C.dominios.INTERFEDICOM) {
			if (process.tipo === K.PROCESOS.TIPOS.MONITOR) {
				// TODO: Falta hacer control de admision por IP origen
				L.xi(txId, ['Se acepta el token INTERFEDICOM'], 'txToken')
				return { ok: true };
			}

			L.xw(txId, ['El token es del dominio INTERFEDICOM y no se admite para este tipo de consulta'], 'txToken');
			let errorFedicom = new ErrorFedicom('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
		}

		// Si se indica la opcion grupoRequerido, es absolutamente necesario que el token lo incluya
		if (opciones.grupoRequerido) {
			if (!req.token.perms || !req.token.perms.includes(opciones.grupoRequerido)) {
				L.xw(txId, ['El token no tiene el permiso necesario', opciones.grupoRequerido, req.token.perms], 'txToken');
				let errorFedicom = new ErrorFedicom('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
			}
		}

		// Si se indica que se admiten simulaciones y el token es del dominio HEFAME, comprobamos si es posible realizar la simulacion
		if (opciones.admitirSimulaciones && req.token.aud === C.dominios.HEFAME) {

			// Si el nodo está en modo productivo, se debe especificar la opción 'admitirSimulacionesEnProduccion' o se rechaza al petición
			if (C.produccion === true && !opciones.admitirSimulacionesEnProduccion) {
				L.xw(txId, ['El concentrador está en PRODUCCION. No se admiten llamar al servicio de manera simulada.', req.token.perms], 'txToken');
				let errorFedicom = new ErrorFedicom('AUTH-005', 'El concentrador está en PRODUCCION. No se admiten llamadas simuladas.', 403);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
			}

			// En caso de que sea viable la simulación, el usuario debe tener el permiso 'FED3_SIMULADOR'
			if (!req.token.perms || !req.token.perms.includes('FED3_SIMULADOR')) {
				L.xw(txId, ['El token no tiene los permisos necesarios para realizar una llamada simulada', req.token.perms], 'txToken');
				let errorFedicom = new ErrorFedicom('AUTH-005', 'No tienes los permisos necesarios para realizar simulaciones', 403);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.NO_AUTORIZADO };
			} else {
				L.xi(txId, ['La consulta es simulada por un usuario del dominio', req.token.sub], 'txToken');

				// Generamos un token con el usuario/dominio indicado en el campo 'authReq' del body
				let solicitudAutenticacion = null;
				if (req.body?.authReq && req.body.authReq.username && req.body.authReq.domain) {
					solicitudAutenticacion = {
						usuario: req.body.authReq.username,
						dominio: req.body.authReq.domain
					}
					L.xi(txId, ['La solicitid simulada viene con una solicitud de autenticación', solicitudAutenticacion], 'txToken')
					let newToken = generarToken(txId, solicitudAutenticacion, []);
					L.xd(txId, ['Se ha generado un token para la solicitud de autenticacion simulada', newToken], 'txToken');
					req.headers['authorization'] = 'Bearer ' + newToken;
					req.token = verificarToken(newToken, txId);
				}

				if (opciones.simulacionRequiereSolicitudAutenticacion && !solicitudAutenticacion) {
					L.xe(txId, ['No se incluye solicitud de autenticación y esta es obligatoria'], 'txToken');
					let errorFedicom = new ErrorFedicom('AUTH-999', 'No se indica el usuario objetivo de la transmisión', 400);
					let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
					return { ok: false, respuesta: cuerpoRespuesta, motivo: K.TX_STATUS.PETICION_INCORRECTA };
				}

				return { ok: true, usuarioSimulador: req.token.sub, solicitudAutenticacion: solicitudAutenticacion };
			}
		}


		L.xi(txId, ['El token transmitido es correcto y está autorizado', req.token], 'txToken');
		return { ok: true };
		*/
	}


	static generarToken(usuario, dominio, datosExtra) {

		let { grupos } = datosExtra;

		let datosToken = {
			sub: usuario,
			aud: dominio,
			exp: Math.ceil((Date.fedicomTimestamp() / 1000) + C.jwt.ttl)
		};

		if (grupos && grupos.forEach) datosToken.grupos = grupos;
		return JsonWebToken.sign(datosToken, C.jwt.clave);
	}

	static extraerDatosToken(token) {
		try {
			return JsonWebToken.verify(token, C.jwt.clave, { clockTolerance: C.jwt.tiempoDeGracia });
		} catch (errorJwt) {
			return { error: errorJwt.message };
		}
	}


}

module.exports = Token;