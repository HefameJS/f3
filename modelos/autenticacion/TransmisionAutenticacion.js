'use strict';
const C = global.config;
const K = global.constants;
//const M = global.mongodb;



const iLdap = require('interfaces/iLdap');
const iCacheCredencialesSap = require('interfaces/isap/iCacheCredencialesSap');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');


const Validador = require('global/validador');
const Token = require('modelos/transmision/Token');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionAutenticacion extends Transmision {

	#metadatos = {					// Metadatos
		aciertoCache: false,		// Indica si la autenticación se resolvió con un acierto de caché
		evitarCache: false,			// Indica si se ha especificado que no debe usarse la caché para verificar las credenciales
		debug: false,				// Indica si se deben dar datos del token extra en la respuesta 
		errorProtocolo: false,		// Indica si la transmisión no es una autenticación válida según la norma Fedicom3
		errorValidacionSap: false	// Indica si hubo error al verificar las credenciales en SAP y por tanto se generó token sin verificar
	};

	#datos = {
		usuario: null,
		clave: null,
		dominio: null,
		grupos: [],
		token: null,
		error: null
	}


	// @Override
	async operar() {
		let json = this.req.body;

		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.user, errorFedicom, 'AUTH-003', 'El parámetro "user" es obligatorio');
		Validador.esCadenaNoVacia(json.password, errorFedicom, 'AUTH-004', 'El parámetro "password" es obligatorio');
		if (errorFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en el mensaje', errorFedicom);
			this.#metadatos.errorProtocolo = true;
			this.#validacionErronea(errorFedicom);
			return;
		}

		this.#datos.usuario = json.user.trim();
		this.#datos.clave = json.password.trim();
		this.#datos.dominio = C.dominios.resolver(json.domain);

		// Es posible que la solicitud sea para transfer, en cuyo caso actualizamos el dominio.
		if (this.isTransfer()) {
			this.#datos.dominio = C.dominios.TRANSFER;
		}

		this.log.info(`Petición de autenticación para ${this.#datos.usuario} en el dominio ${this.#datos.dominio}`);

		// Copia de propiedades no estandard
		// noCache - Indica si la autenticación debe evitar siempre la búsqueda en caché
		if (json.noCache) {
			this.#metadatos.evitarCache = Boolean(json.noCache);
			this.log.debug('La petición indica que no debe usarse la caché');
		}

		// debug - Indica si la respuesta a la petición debe incluir los datos del token en crudo
		if (json.debug) {
			this.#metadatos.debug = Boolean(json.debug);
			this.log.debug('La petición indica que se devuelva información de depuración');
		}

		return await this.#verificarCredenciales();
	}

	// @Override
	generarMetadatosOperacion() {
		let metadatos = {}
		if (this.#metadatos.aciertoCache) metadatos.aciertoCache = this.#metadatos.aciertoCache;
		if (this.#metadatos.evitarCache) metadatos.evitarCache = this.#metadatos.evitarCache;
		if (this.#metadatos.debug) metadatos.debug = this.#metadatos.debug;

		this.setMetadatosOperacion('autenticacion', metadatos);
	}


	isTransfer() {
		return this.#datos.dominio === C.dominios.TRANSFER || (this.#datos.dominio === C.dominios.FEDICOM && this.#datos.usuario.search(/^T[RGP]/) !== -1);
	}


	generarJSON() {
		return {
			domain: this.#datos.dominio,
			username: this.#datos.usuario,
			password: this.#datos.clave
		}
	}


	#validacionErronea(error) {
		this.#datos.error = error;
	}

	#validacionCorrecta(datos) {
		
		let { grupos } = datos || {};
		this.#datos.grupos = grupos;
		this.#generarToken();
	}

	#generarToken() {
		let datosExtra = {};

		if (this.#datos.grupos) {
			datosExtra.grupos = this.#datos.grupos;
		}

		this.#datos.token = Token.generarToken(this.#datos.usuario, this.#datos.dominio, datosExtra)
		this.log.info('Se ha generado un token para el usuario', this.#datos.token)
	}

	async #verificarCredenciales() {

		if (!this.#metadatos.errorProtocolo) {

			switch (this.#datos.dominio) {
				case C.dominios.FEDICOM:
				case C.dominios.TRANSFER:
					// Las peticiones a los dominios FEDICOM y TRANSFER se verifican contra SAP
					await this.#autenticarContraSAP();
					break;
				case C.dominios.HEFAME:
					// Las peticiones al dominio HEFAME se verifica contra el LDAP
					await this.#autenticarContraLDAP();
					break;
				default: {
					// Las peticiones de otros dominios no son legales
					this.log.warn(`No se permite la expedición de tokens para el dominio ${this.#datos.dominio}`);
					this.#validacionErronea(new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401))
				}
			}

		}

		return this.#determinarResultadoAutenticacion();
	}

	async #autenticarContraSAP() {

		// Comprobacion de si la credencial del usuario se encuenta en la caché
		if (!this.#metadatos.evitarCache) {

			let resultadoCache = iCacheCredencialesSap.chequearSolicitud(this.#datos);

			if (resultadoCache) {
				this.log.info('Se produjo un acierto de caché con las credenciales de usuario');
				this.#metadatos.aciertoCache = true;
				this.#validacionCorrecta();
				return;
			} else {
				this.log.debug('No se encontró información del usuario en la caché')
			}

		}

		this.log.info('Se procede a comprobar en SAP las credenciales de la petición');

		try {
			// TODO
			this.sap.setTimeout(C.sap.timeout.verificarCredenciales);
			let respuestaSap = await this.sap.post('/api/zverify_fedi_credentials', this.generarJSON());

			// await iSap.autenticacion.verificarCredenciales(this);

			// Si el mensaje de SAP contiene el parámetro 'username', es que las credenciales son correctas.
			// de lo contrario, es que son incorrectas.
			if (respuestaSap.username) {

				this.log.info('SAP indica que las credenciales del usuario son correctas')

				// Guardamos la entrada en caché
				if (!this.#metadatos.evitarCache) {
					iCacheCredencialesSap.agregarEntrada(this.#datos);
					this.log.debug('Se incorporan las credenciales del usuario a la caché')
				}

				this.#validacionCorrecta();

			} else {
				this.log.warn('SAP indica que las credenciales del usuario son incorrectas', respuestaSap);
				this.#validacionErronea(new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401))
			}

		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error en la llamada a SAP, se genera un token no verificado', errorLlamadaSap);
			this.#validacionCorrecta();
			this.#metadatos.errorValidacionSap = true;
		}

	}

	async #autenticarContraLDAP() {
		this.log.info('Se procede a comprobar en Active Directory las credenciales de la petición');

		try {
			let grupos = await iLdap.autenticar(this.#datos);
			this.log.debug('Usuario validado por LDAP, grupos obtenidos:', grupos);
			this.#validacionCorrecta({ grupos });

		} catch (errorLdap) {
			this.log.error('La autenticación LDAP no fue satisfatoria. No se genera token', errorLdap);
			this.#validacionErronea(new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401))
		}

	}

	#determinarResultadoAutenticacion() {
		let codigoEstadoHttp,
			codigoEstadoTransmision,
			cuerpoRespuestaHttp;

		if (this.#datos.token) {
			codigoEstadoHttp = 201;
			codigoEstadoTransmision = this.#metadatos.errorValidacionSap ? K.ESTADOS.ERROR_RESPUESTA_SAP : K.ESTADOS.COMPLETADO;
			cuerpoRespuestaHttp = {
				auth_token: this.#datos.token
			}

			if (this.#metadatos.debug) {
				cuerpoRespuestaHttp.datos = Token.extraerDatosToken(this.#datos.token);
			}

		} else {
			codigoEstadoHttp = this.#datos.error.getCodigoRespuestaHttp();
			codigoEstadoTransmision = K.ESTADOS.FALLO_AUTENTICACION;
			cuerpoRespuestaHttp = this.#datos.error.getErrores()
		}

		return new ResultadoTransmision(codigoEstadoHttp, codigoEstadoTransmision, cuerpoRespuestaHttp);
	}


}


TransmisionAutenticacion.TIPO = K.TIPOS.AUTENTICACION;
TransmisionAutenticacion.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: true
});


TransmisionAutenticacion.procesar = async function (req, res) {
	await Transmision.ejecutar(req, res, TransmisionAutenticacion);
}


module.exports = TransmisionAutenticacion;