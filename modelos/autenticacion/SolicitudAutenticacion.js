'use strict';
const C = global.C;


const Validador = require("global/validador");
const ErrorFedicom = require("modelos/ErrorFedicom");
const Modelo = require("modelos/transmision/Modelo");
const ResultadoTransmision = require("modelos/transmision/ResultadoTransmision");
const Token = require("modelos/transmision/Token");


class SolicitudAutenticacion extends Modelo {

	metadatos = {
		errores: new ErrorFedicom(),
		errorProtocolo: false,
		evitarCache: false,
		debug: false,
		token: null
	}

	usuario;
	clave;
	dominio;

	constructor(transmision) {
		super(transmision);

		let json = transmision.req.body;

		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.user, errorFedicom, 'AUTH-003', 'El parámetro "user" es obligatorio');
		Validador.esCadenaNoVacia(json.password, errorFedicom, 'AUTH-004', 'El parámetro "password" es obligatorio');
		if (errorFedicom.tieneErrores()) {
			this.log.warn('Se han detectado errores de protocolo en el mensaje', errorFedicom);
			this.metadatos.errorProtocolo = true;
			this.metadatos.errores = errorFedicom;
			return;
		}

		this.usuario = json.user.trim();
		this.clave = json.password.trim();
		this.dominio = C.dominios.resolver(json.domain);

		this.log.debug(`Se resuelve el dominio ${json.domain} -> ${this.dominio}`)

		// Es posible que la solicitud sea para transfer, en cuyo caso actualizamos el dominio.
		if (this.dominio === C.dominios.FEDICOM && this.usuario.search(/^T[RGP]/) !== -1) {
			this.log.info(`La petición cumple la norma de pedidos transfer`);
			this.dominio = C.dominios.TRANSFER;
		}

		this.log.info(`Petición de autenticación para ${this.usuario} en el dominio ${this.dominio}`);

		// Copia de propiedades no estandard
		// noCache - Indica si la autenticación debe evitar siempre la búsqueda en caché
		if (json.noCache) {
			this.metadatos.evitarCache = Boolean(json.noCache);
			this.log.debug('La petición indica que no debe usarse la caché');
		}

		// debug - Indica si la respuesta a la petición debe incluir los datos del token en crudo
		if (json.debug) {
			this.metadatos.debug = Boolean(json.debug);
			this.log.debug('La petición indica que se devuelva información de depuración');
		}

	}

	esTransfer() {
		return this.dominio === C.dominios.TRANSFER;
	}

	#generarToken(datosExtra) {
		if (!datosExtra) datosExtra = {}
		
		this.metadatos.token = Token.generarToken(this.usuario, this.dominio, datosExtra)
		this.log.info('Se ha generado un token para el usuario', this.metadatos.token)
	}

	generarRespuestaToken(estado, datosExtra) {
		this.#generarToken(datosExtra);

		let respuesta = {
			auth_token: this.metadatos.token
		}

		if (this.metadatos.debug) {
			respuesta.datos = Token.extraerDatosToken(this.metadatos.token);
		}

		return new ResultadoTransmision(201, estado, respuesta);
		
		
	}

	generarJSON(tipoReceptor = 'sap') {
		if (this.metadatos.errorProtocolo) {
			return this.metadatos.errores.getErrores();
		}

		return {
			domain: this.dominio,
			username: this.usuario,
			password: this.clave
		}
	}

}


module.exports = SolicitudAutenticacion;