'use strict';
const C = global.C;
const K = global.K;

const Ldap = require('global/ldap');
const CacheCredencialesSap = require('modelos/autenticacion/CacheCredencialesSap');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const SolicitudAutenticacion = require('./SolicitudAutenticacion');

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionAutenticacion extends Transmision {

	metadatos = {					// Metadatos
		aciertoCache: false		// Indica si la autenticación se resolvió con un acierto de caché
	};

	#solicitud;

	// @Override
	async operar() {

		this.#solicitud = new SolicitudAutenticacion(this);

		if (this.#solicitud.metadatos.errorProtocolo) {
			return new ResultadoTransmision(400, K.ESTADOS.PETICION_INCORRECTA, this.#solicitud.generarJSON('errores'));
		}

		switch (this.#solicitud.dominio) {
			case C.dominios.FEDICOM:
			case C.dominios.TRANSFER:
				// Las peticiones a los dominios FEDICOM y TRANSFER se verifican contra SAP
				return await this.#autenticarContraSAP();
			case C.dominios.HEFAME:
				// Las peticiones al dominio HEFAME se verifica contra el LDAP
				return await this.#autenticarContraLDAP();
			default: {
				// Las peticiones de otros dominios no son legales
				this.log.warn(`No se permite la expedición de tokens para el dominio '${this.#solicitud.dominio}'`);
				let errorFedicom = new ErrorFedicom('AUTH-999', 'No se permite la expedición de tokens para el dominio', 400);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
			}
		}


	}



	async #autenticarContraSAP() {

		// Comprobacion de si la credencial del usuario se encuenta en la caché
		if (!this.#solicitud.metadatos.evitarCache) {

			let resultadoCache = CacheCredencialesSap.chequearSolicitud(this.#solicitud);

			if (resultadoCache) {
				this.log.info('Se produjo un acierto de caché con las credenciales de usuario');
				this.metadatos.aciertoCache = true;
				return this.#solicitud.generarRespuestaToken(K.ESTADOS.COMPLETADO);
			} else {
				this.log.debug('No se encontró información del usuario en la caché');
			}

		}

		this.log.info('Se procede a comprobar en SAP las credenciales de la petición');

		try {
			this.sap.setTimeout(C.sap.timeout.verificarCredenciales);
			let respuestaSap = await this.sap.post('/api/zverify_fedi_credentials', this.#solicitud.generarJSON('sap'));

			// Si el mensaje de SAP contiene el parámetro 'username', es que las credenciales son correctas.
			// de lo contrario, es que son incorrectas.
			if (respuestaSap.username) {

				this.log.info('SAP indica que las credenciales del usuario son correctas')

				// Guardamos la entrada en caché
				if (!this.metadatos.evitarCache) {
					CacheCredencialesSap.agregarEntrada(this.#solicitud);
					this.log.debug('Se incorporan las credenciales del usuario a la caché');
				}

				return this.#solicitud.generarRespuestaToken(K.ESTADOS.COMPLETADO);

			} else {
				this.log.warn('SAP indica que las credenciales del usuario son incorrectas', respuestaSap);
				let errorFedicom = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
				return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
			}

		} catch (errorLlamadaSap) {
			this.log.err('Ocurrió un error en la llamada a SAP, se genera un token no verificado', errorLlamadaSap);
			return this.#solicitud.generarRespuestaToken(K.ESTADOS.ERROR_RESPUESTA_SAP);
		}

	}

	async #autenticarContraLDAP() {
		this.log.info('Se procede a comprobar en Active Directory las credenciales de la petición');

		try {
			let grupos = await Ldap.autenticar(this.#solicitud);
			this.log.debug('Usuario validado por LDAP, grupos obtenidos:', grupos);
			return this.#solicitud.generarRespuestaToken(K.ESTADOS.COMPLETADO, { grupos });
		} catch (errorLdap) {
			this.log.err('La autenticación LDAP no fue satisfatoria. No se genera token', errorLdap);
			let errorFedicom = new ErrorFedicom('AUTH-005', 'Usuario o contraseña inválidos', 401);
			return errorFedicom.generarResultadoTransmision(K.ESTADOS.PETICION_INCORRECTA);
		}

	}



	// @Override
	generarMetadatosOperacion() {
		let metadatos = {}
		if (this.metadatos.aciertoCache) metadatos.aciertoCache = this.metadatos.aciertoCache;
		if (this.#solicitud.evitarCache) metadatos.evitarCache = this.#solicitud.evitarCache;

		this.setMetadatosOperacion('autenticacion', metadatos);
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