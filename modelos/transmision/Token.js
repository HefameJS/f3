'use strict';

const C = global.C;
const JsonWebToken = require('jsonwebtoken');
const ErrorFedicom = require('modelos/ErrorFedicom');
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
	#jwt = null; 				// (string) El token de la transmisión(null si no aparece)
	#permanente;				// (bool) Indica si el token es permanente o no (true|false).
	#verificado = false;		// (bool) Indica si el token es válido o no (true|false)
	#autorizado = false;		// (bool) Indica si el token ha sido autorizado a realizar la acción
	#solicitante = null;		// (null|Object) Indica el {usuario, dominio} que solicita la transmisión
	#condicionesAutorizacion;	// (CondicionesAutorizacion) Objeto con las condiciones que la transmision debe cumplir para que se autorice.
	#error = null;				// (ErrorFedicom) Indica un objeto de Error si se encuentra algún error en el tratamiento del token. null si no hay errores.

	usuario;					// (string) El usuario del token. undefined si no aplica.
	dominio;					// (string) El dominio al que pertenece el usuario del token. undefined si no aplica.
	fechaDeExpiracion;			// (Date) La fecha de expiración del token en un objeto Date. undefined si no aplica.
	fechaDeEmision;				// (Date) La fecha de emision del token en un objeto Date. undefined si no aplica.
	grupos = [];				// (Array[string]) Un array con los permisos del token.

	/**
	 * Para una transmisión dada, analiza los datos de autenticación de la misma para determinar si son válidos. 
	 * De ser válidos, se comprueba que cumplan los requisitos de autorización del objeto de condiciones de autorización.
	 * @param {*} transmision La transmisión que se está verificando
	 * @param {*} condicionesAutorizacion Objeto de condiciones de autorización que deben cumplirse.
	 */
	constructor(transmision, condicionesAutorizacion) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;
		this.#condicionesAutorizacion = condicionesAutorizacion || new CondicionesAutorizacion();

		let cabeceraAutorizacion = this.#transmision.req.headers?.authorization;
		//this.#log.trace('Cabecera de autenticación recibida:', cabeceraAutorizacion);

		if (cabeceraAutorizacion) {
			if (cabeceraAutorizacion.startsWith('Bearer ')) {
				this.#jwt = cabeceraAutorizacion.slice(7);
			}
		}

		this.#log.debug('Verificando la validez del token')
		this.#verificarJwt();
		this.#comprobarAutorizacion();

	}

	/**
	 * Retorna el token tal cual se encuentra en la petición HTTP, en un string sin procesar.
	 */
	getJwt() {
		return this.#jwt;
	}

	/**
	 * Obtiene el objeto 'login' que hay que mandarle a SAP para informar del usuario/dominio de la operación.
	 * @returns 
	 */
	getDatosLoginSap() {
		return {
			username: this.usuario,
			domain: this.dominio
		}
	}

	/**
 	 * Devuelve un ErrorFedicom si se ha encontrado algún error en la autenticacion/autorización del token.
 	 * @returns ErrorFedicom si se ha encontrado algún error en la autenticacion/autorización del token o null si no hay errores.
 	 */
	getError() {
		return this.#error;
	}

	/**
	 * **INTERNO**
	 * Llamada para uso interno el el flujo de ejecución de cualquier transmisión. No tiene especial utilidad
	 * fuera de este flujo.
	 * 
	 * La función devuelve un objeto con los metadatos que se incluirán en la base de datos cuando la transmisión
	 * sea registrada.
	 */
	generarMetadatos() {
		if (this.#verificado) {
			let flag = {
				usuario: this.usuario,
				dominio: this.dominio,
				usuarioNormalizado: Token.normalizaNombreUsuario(this.usuario, this.dominio)
			};

			if (this.#solicitante) {
				flag.solicitante = this.#solicitante;
			}
			return flag;
		}
		return null;
	}





	/**
	 * Verifica y extrae los datos del token.
	 * Si el token se verifica, #verificado se establece a true. De lo contrario, se establece el error pertinente en #error.
	 * @returns 
	 */
	#verificarJwt() {

		if (!this.#jwt) {
			return;
		}

		try {

			let tokenDecodificado = JsonWebToken.verify(this.#jwt, C.jwt.clave, { clockTolerance: C.jwt.tiempoDeGracia });
			this.#verificado = true;

			this.usuario = tokenDecodificado.sub;
			this.dominio = tokenDecodificado.aud;

			// Los tokens permanentes llevan exp = 9999999999, iat = 0
			// Por error, algunos se generaron con exp = 9999999999999, iat = 1
			if (tokenDecodificado.exp >= 9999999999 && tokenDecodificado.iat <= 1) {
				this.#permanente = true;
			} else {
				this.#permanente = false;
				this.fechaDeExpiracion = new Date();
				this.fechaDeExpiracion.setTime(tokenDecodificado.exp * 1000);
				this.fechaDeEmision = new Date();
				this.fechaDeEmision.setTime(tokenDecodificado.iat * 1000);
			}

			// Copiamos los permisos del usuario, si los hubiere
			if (Array.isArray(tokenDecodificado.grupos)) {
				this.grupos = tokenDecodificado.grupos.map(permisoBruto => permisoBruto)
			}

		} catch (errorJwt) {
			this.#log.warn(`El token de la transmisión no es válido. Motivo: ${errorJwt.message}`);
			this.#error = new ErrorFedicom('AUTH-002', 'Token inválido', 401);
		}
	}

	/**
	 * Funcion que verifica los permisos del token de una petición entrante para comprobar si
	 * cumple con los requisitos establecidos en las CondicionesAutorizacion.
	 * Si el token se autoriza, #autorizado se establece a true. De lo contrario, se establece el error pertinente en #error.
	 */
	#comprobarAutorizacion() {

		let opciones = this.#condicionesAutorizacion;

		// Primerísimo de todo, ¿ es obligatorio autenticarse ?
		if (opciones.admitirSinTokenVerificado) {
			this.#autorizado = true;
			this.#log.info('No se requiere token para esta operación, la transmisión queda autorizada');
			return;
		} else if (!this.#verificado) {
			this.#log.warn('El token de la transmisión no es válido o no se especifica',);
			this.#error = new ErrorFedicom('AUTH-001', 'Usuario no autentificado', 401);
			return;
		}

		// Las llamadas al monitor deben venir de los dominios INTERFEDICOM, MONITOR o HEFAME
		if (opciones.llamadaMonitor) {
			let dominiosAdmitidos = [K.DOMINIOS.INTERFEDICOM, K.DOMINIOS.MONITOR, K.DOMINIOS.HEFAME];

			if (dominiosAdmitidos.includes(this.dominio)) {
				this.#log.trace('La transmisión es de tipo monitor y contiene un domino válido');
			} else {
				this.#log.err(`Los tokens del dominio ${this.dominio} no se admiten en llamadas de tipo monitor.`);
				this.#error = new ErrorFedicom('AUTH-006', 'El usuario no tiene permisos para realizar esta acción', 403);
				return;
			}
		}

		// Si se indica la opcion grupoRequerido, es absolutamente necesario que el token lo incluya
		if (opciones.grupoRequerido) {
			if (!this.grupos.includes(opciones.grupoRequerido)) {
				this.#log.err(`El token no pertenece al grupo ${opciones.grupoRequerido}. Grupos: `, this.grupos);
				this.#error = new ErrorFedicom('AUTH-006', 'El usuario no tiene permisos para realizar esta acción', 403);
				return;
			}
		}

		// Si se indica que se admiten simulaciones y el token es del dominio HEFAME, comprobamos si es posible realizar la simulacion
		if (opciones.simulaciones && this.dominio === K.DOMINIOS.HEFAME) {

			// Si el nodo está en modo productivo, se debe especificar la opción 'admitirSimulacionesEnProduccion' o se rechaza la petición
			if (C.produccion === true && !opciones.simulacionesEnProduccion) {
				this.#log.err('El concentrador está en PRODUCCION. No se admiten llamar al servicio de manera simulada.');
				this.#error = new ErrorFedicom('AUTH-006', 'El usuario no tiene permisos para realizar esta acción', 403);
				return;
			}

			// En caso de que sea viable la simulación, el usuario debe tener el permiso 'FED3_SIMULADOR'
			if (!this.grupos.includes('FED3_SIMULADOR')) {
				this.#log.err('El token no pertenece al grupo "FED3_SIMULADOR" necesario para realizar simulaciones', this.grupos);
				this.#error = new ErrorFedicom('AUTH-006', 'El usuario no tiene permisos para realizar esta acción', 403);
				return;
			}

			this.#log.info(`La transmisión es simulada por el usuario ${this.usuario}@${this.dominio}`);


			// Buscamos las cabeceras 'x-simulacion-usuario' y 'x-simulacion-dominio' para generar un token simulando a este usuario
			let usuarioSimulado = this.#transmision.req.headers?.['x-simulacion-usuario']?.trim?.();
			let dominioSimulado = this.#transmision.req.headers?.['x-simulacion-dominio']?.trim?.();

			if (!usuarioSimulado || !dominioSimulado) {
				this.#log.err('No se han hayado datos del usuario en nombre del cual se hace la transmisión');
				this.#error = new ErrorFedicom('AUTH-006', 'El usuario no tiene permisos para realizar esta acción', 403);
				return;
			}

			this.#solicitante = {
				usuario: this.usuario,
				dominio: this.dominio
			};

			this.#jwt = Token.generarToken(usuarioSimulado, dominioSimulado);
			this.#verificarJwt();

			this.#log.info(`La transmisión se realiza en nombre de ${this.usuario}@${this.dominio}`);
		}

		this.#autorizado = true;
		this.#log.info(`El token transmitido queda autorizado. [usuario=${this.usuario}, dominio=${this.dominio}]`);
		return;

	}


	/**
	 * Genera un JWT para el ususario@dominio inidicados. Permite adjuntar datos extra:
	 * - grupos: Una lista de grupos a los que pertenece el usuario.
	 * - permanente: (true|false) Si queremos que se genere un token que no caduca.
	 * @param {*} usuario El nombre del usuario.
	 * @param {*} dominio El dominio del usuario.
	 * @param {*} datosExtra Datos extra para el token generado.
	 * @returns Un string con el JWT generado en Base64
	 */
	static generarToken(usuario, dominio, datosExtra) {

		let { grupos, permanente } = datosExtra || {};

		let datosToken = {
			sub: usuario,
			aud: dominio,
			exp: Math.ceil((Date.fedicomTimestamp() / 1000) + C.jwt.ttl)
		};

		if (permanente) {
			datosToken.iat = 1;
			datosToken.exp = 9999999999;
			datosToken.permanente = true;
		}

		if (grupos && grupos.forEach) datosToken.grupos = grupos;
		return JsonWebToken.sign(datosToken, C.jwt.clave);
	}

	/**
	 * Devuelve un objeto con los datos extraidos de un token indicado.
	 * En caso de que el token no fuera válido, se devuelve un objeto con la forma
	 * { error: "errorJwt.message" };
	 * @param {*} token 
	 * @returns 
	 */
	static extraerDatosToken(token) {
		try {
			return JsonWebToken.verify(token, C.jwt.clave, { clockTolerance: C.jwt.tiempoDeGracia });
		} catch (errorJwt) {
			return { error: errorJwt.message };
		}
	}

	/**
	 * **CONVER**
	 * Esta función convierte un nombre de usuario/dominio y lo normaliza.
	 * Esto significa que de algún modo lo simplifica, con el fin de que realizar búsquedas por este campo
	 * sea mas eficiente y efectivo.
	 * 
	 * - "yyyxxxxx@hefame" -> xxxxx : Extrae el código de farmacia corto (entero, 5 dígitos)
	 * - "BFyyyyyxxxxx"    -> xxxxx : Extrae el código de farmacia corto (entero, 5 dígitos)
	 * - "TRxxxxxxxx"      -> xxxxxxxxx : Extrae el código de laboratorio (entero, 8 dígitos)
	 * - "602xxxxx"        -> 602xxxxx : Extrae el código de laboratorio  (entero, 8 dígitos)
	 * - "(y*)xxxxx"       -> xxxxx : Extrae el código de farmacia corto (entero, 5 dígitos)
	 * - Cualquier otro valor, devuelve un string convertido a mayúsculas.
	 * 
	 * @param {*} usuario 
	 * @param {*} dominio 
	 * @returns 
	 */
	static normalizaNombreUsuario(usuario, dominio) {
		// Caso Hefame 00000000@hefame
		if (/^[0-9]{8}@hefame$/.test(usuario)) return parseInt(usuario.substr(3, 5));
		// Caso BorginoFarma BF0000000000
		if (/^BF[0-9]{10}}$/.test(usuario)) return parseInt(usuario.slice(-5));
		// Caso Transfer TR00000000, TG00000000, TP00000000
		if (/^T(R|G|P)[0-9]{8}$/.test(usuario)) return parseInt(usuario.slice(-8));
		// Es un entero
		if (/^[0-9]+$/.test(usuario)) {
			// Si es 602xxxxx, asumimos que es laboratorio y lo dejamos tal cual
			if (usuario.startsWith('602')) return parseInt(usuario);
			// En cualquier otro caso, lo convertimos a entero
			return parseInt(usuario.slice(-5));
		}
		return usuario.toUpperCase();
	}


}

module.exports = Token;