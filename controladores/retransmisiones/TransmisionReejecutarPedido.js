'use strict';
const K = global.K;
const M = global.M;


const Transmision = require('modelos/transmision/Transmision');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const PostTransmision = require('modelos/transmision/PostTransmision');
const TransmisionCrearPedido = require('controladores/transmisiones/pedido/TransmisionCrearPedido');


/**
 * Esta es la entrada MAXIMA que podría aparecer:
 * {
 *     "sistemaExterno": {		// OPCIONAL: Indica el concentrador remoto al que enviar los datos. Si no aparece, la reejecucion se hace internamente.
 * 			"url": "https://fedicom3-dev.hefame.es",
 * 			"autenticacion": {
 *				"usuario": "Alejandro_AC",
 * 				"password": "webos",
 * 				"dominio": "HEFAME"
 * 			},
 * 			"simulacion": {
 * 				"usuario": "10107506@hefame",
 * 				"dominio": "FEDICOM"
 * 			}
 * 		},
 * 		"codigoAlmacenServicio": "RG19",
 * 		"tipoPedido": "029",
 * 		"generarCrcUnico": true // No se aplica si existe el sistema externo.
 * }
 * 
 */
class ModificacionesPedido {

	#req = null;
	#jwt = null;

	generarCrcUnico = false;
	sistemaExterno = null;

	modificaciones = {
	}

	constructor(req) {
		this.#req = req;
		let modificacionesPropuestas = this.#req.body;
		if (modificacionesPropuestas.generarCrcUnico) this.generarCrcUnico = true;

		if (modificacionesPropuestas.tipoPedido !== undefined) {
			this.modificaciones.tipoPedido = modificacionesPropuestas.tipoPedido;
			this.generarCrcUnico = true;
		}
		if (modificacionesPropuestas.codigoAlmacenServicio !== undefined) {
			this.modificaciones.codigoAlmacenServicio = modificacionesPropuestas.codigoAlmacenServicio;
			this.generarCrcUnico = true;
		}

		if (modificacionesPropuestas.sistemaExterno) {
			this.sistemaExterno = modificacionesPropuestas.sistemaExterno;
			// TODO: 'sistemaExterno' es un objeto. Verificar que los campos son correctos
		}
	}

	aplicarModificacionesSobreRequest(req) {
		if (this.modificaciones.tipoPedido) req.body.tipoPedido = this.modificaciones.tipoPedido
		if (this.modificaciones.codigoAlmacenServicio) req.body.codigoAlmacenServicio = this.modificaciones.codigoAlmacenServicio
	}

	async #obtenerTokenSistemaExterno() {

		let parametrosHttp = {
			method: 'POST',
			url: this.sistemaExterno.url + '/authenticate',
			headers: {
				"software-id": K.SOFTWARE_ID.RETRANSMISOR
			},
			data: {
				user: this.sistemaExterno.autenticacion.usuario,
				password: this.sistemaExterno.autenticacion.password,
				domain: this.sistemaExterno.autenticacion.dominio || C.dominios.nombreDominioPorDefecto
			},
			validateStatus: () => true
		};


		let respuesta = await axios(parametrosHttp);
		if (respuesta.data?.auth_token) {
			this.#jwt = respuesta.data.auth_token;
		} else if (Array.isArray(respuesta.data)) {
			let errorFedicom = new ErrorFedicom();
			respuesta.data.forEach(error => errorFedicom.insertar(error))
			throw errorFedicom;
		} else {
			throw new ErrorFedicom('HTTP-999', 'No se ha podido obtener el token');
		}


	}

	async prepararLlamadaSistemaExterno(req) {

		if (!this.#jwt) {
			await this.#obtenerTokenSistemaExterno();
		}

		let parametrosHttp = {
			method: req.method,
			url: this.sistemaExterno.url + req.url,
			headers: req.headers,
			data: req.body,
			validateStatus: () => true
		};

		parametrosHttp.headers["authorization"] = 'Bearer ' + this.#jwt;
		delete parametrosHttp.headers['host'];
		delete parametrosHttp.headers['content-length'];

		if (this.sistemaExterno.simulacion) {
			parametrosHttp.headers["x-simulacion-usuario"] = this.sistemaExterno.simulacion.usuario;
			parametrosHttp.headers["x-simulacion-dominio"] = this.sistemaExterno.simulacion.dominio;

			// Para compatibilidad con concentradores en versiones 1.x
			parametrosHttp.data.authReq = {
				username: this.sistemaExterno.simulacion.usuario,
				domain: this.sistemaExterno.simulacion.dominio
			}
		}

		return parametrosHttp;
	}

	hayModificaciones() {
		if (this.generarCrcUnico) return true;
		if (Object.keys(this.modificaciones).length) return true;
		return false;
	}

}

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionReejecutarPedido extends Transmision {

	modificaciones = null;
	// @Override
	async operar() {

		let txId = this.req.params.txId;

		this.modificaciones = new ModificacionesPedido(this.req);

		this.log.info(`Solicitud de reejecución del pedido con ID ${txId} con modificaciones:`, this.modificaciones);

		try {
			let oid = M.ObjectID.createFromHexString(txId);
			let postTransmision = await PostTransmision.instanciar({ _id: oid }, true);
			let { req, res } = await postTransmision.prepararReejecucion();
			this.modificaciones.aplicarModificacionesSobreRequest(req);

			if (this.modificaciones.sistemaExterno) {

				this.log.info('Se procede al envío de la petición al sistema externo');

				try {
					let parametros = await this.modificaciones.prepararLlamadaSistemaExterno(req);
					let respuesta = await axios(parametros);
					this.log.info(`La llamada al sistema externo ha finalizado con código HTTP ${respuesta.status}`);
					return new ResultadoTransmision(200, K.ESTADOS.NO_CONTROLADA, { resultado: respuesta.data });
				} catch (error) {
					this.log.warn('La llamada al sistema externo ha fallado:', error);
					let errorFedicom = new ErrorFedicom(error);
					return new ResultadoTransmision(200, K.ESTADOS.NO_CONTROLADA, { resultado: errorFedicom.getErrores() });
				}


			} else {

				let reTransmision = await Transmision.ejecutar(req, res, TransmisionCrearPedido, {
					idTransmisionOriginal: oid,
					modificaciones: this.modificaciones
				})

				// Actualizamos la transmision original, indicando la nueva retransmisión que se ha hecho sobre la misma
				postTransmision.setMetadatosOperacion('pedido.reejecuciones', reTransmision.txId, '$push');
				postTransmision.actualizarTransmision();
			}

			return new ResultadoTransmision(200, K.ESTADOS.NO_CONTROLADA, req);
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision(K.ESTADOS.NO_CONTROLADA);
		}
	}

}






TransmisionReejecutarPedido.TIPO = K.TIPOS.NO_CONTROLADA;
TransmisionReejecutarPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: 'FED3_RETRANSMISOR',
	simulaciones: false,
	simulacionesEnProduccion: false
});


module.exports = TransmisionReejecutarPedido;