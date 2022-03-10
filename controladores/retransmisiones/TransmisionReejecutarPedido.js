'use strict';
const K = global.K;
const M = global.M;

const Transmision = require('modelos/transmision/Transmision');
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');

const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const PostTransmision = require('modelos/transmision/PostTransmision');
const TransmisionCrearPedido = require('controladores/transmisiones/pedido/TransmisionCrearPedido');
const { default: axios } = require('axios');
const clone = require('clone');


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

	transmisionOriginal = null;
	#mantenerCrcOriginal = true;
	sistemaExterno = null;
	#crcForzado = null;

	#modificaciones = {
	}

	constructor(req, txIdOriginal) {
		this.#req = req;
		this.transmisionOriginal = txIdOriginal;

		let modificacionesPropuestas = this.#req.body;
		if (modificacionesPropuestas.generarCrcUnico) {
			this.#modificaciones.generarCrcUnico = true;
			this.#mantenerCrcOriginal = false;
		}

		if (modificacionesPropuestas.tipoPedido !== undefined) {
			this.#modificaciones.tipoPedido = modificacionesPropuestas.tipoPedido;
			this.#mantenerCrcOriginal = false;
		}
		if (modificacionesPropuestas.codigoAlmacenServicio !== undefined) {
			this.#modificaciones.codigoAlmacenServicio = modificacionesPropuestas.codigoAlmacenServicio;
			this.#mantenerCrcOriginal = false;
		}

		if (modificacionesPropuestas.sistemaExterno) {
			this.sistemaExterno = modificacionesPropuestas.sistemaExterno;
			// TODO: 'sistemaExterno' es un objeto. Verificar que los campos son correctos
		}
	}

	aplicarModificacionesSobreRequest(req) {
		if (this.#modificaciones.tipoPedido) req.body.tipoPedido = this.#modificaciones.tipoPedido
		if (this.#modificaciones.codigoAlmacenServicio) req.body.codigoAlmacenServicio = this.#modificaciones.codigoAlmacenServicio
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
				domain: this.sistemaExterno.autenticacion.dominio || K.DOMINIOS.FEDICOM
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
		if (Object.keys(this.#modificaciones).length) return true;
		return false;
	}

	fuezaCrcConcreto(crc) {
		this.#crcForzado = crc;
	}

	crcForzado() {
		return this.#crcForzado;
	}

	generaUnClon() {
		return !this.#mantenerCrcOriginal;
	}

	generarMetadatos() {
		let metadatos = {
			transmisionOriginal: this.transmisionOriginal,
			clonado: this.generaUnClon(),
			...this.#modificaciones,
		}
		if (this.sistemaExterno) {
			metadatos.sistemaExterno = clone(this.sistemaExterno);
			if (metadatos.sistemaExterno.autenticacion)
				metadatos.sistemaExterno.autenticacion.password = '*******';
		}
		return metadatos;
	}

}

/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TransmisionReejecutarPedido extends TransmisionLigera {

	modificaciones = null;
	// @Override
	async operar() {


		let txId = this.req.params.txId;
		this.log.info(`Solicitud de reejecución del pedido con ID '${txId}'`);

		try {

			let oid = M.ObjectID.createFromHexString(txId);
			this.modificaciones = new ModificacionesPedido(this.req, oid);

			this.log.info(`Se indican las siguientes modificaciones:`, this.modificaciones.generarMetadatos());
			let postTransmision = await PostTransmision.instanciar({ _id: oid }, true);

			if (!postTransmision) {
				let error = new ErrorFedicom('RTX-ERR-001', 'No se encuentra la transmisión original');
				return new ResultadoTransmisionLigera(200, { errores: error.getErrores() });
			}

			postTransmision.log.info(`La solicitud '${this.txId}' lanza una reejecucion del pedido`);
			postTransmision.log.info(`Usuario que ordena la reejecución: [usuario=${this.token.usuario}, dominio=${this.token.dominio}]`);
			postTransmision.log.info(`Modificaciones indicadas sobre el pedido`, this.modificaciones.generarMetadatos());

			let { req, res } = await postTransmision.prepararReejecucion();
			this.modificaciones.aplicarModificacionesSobreRequest(req);

			if (this.modificaciones.sistemaExterno) {

				this.log.info('Se procede al envío de la petición al sistema externo');
				postTransmision.log.info('La reejecución es sobre un sistema externo');

				try {
					let parametros = await this.modificaciones.prepararLlamadaSistemaExterno(req);
					let respuesta = await axios(parametros);
					this.log.info(`La llamada al sistema externo ha finalizado con código HTTP ${respuesta.status}`);

					if (respuesta.headers?.['x-txid']) {
						postTransmision.log.info(`El sistema externo indica que se ha generado el ID '${respuesta.headers['x-txid']}'`);
						this.log.info(`El sistema externo indica que se ha generado el ID ${respuesta.headers['x-txid']}`);
					}

					return new ResultadoTransmisionLigera(200, { codigoEstado: respuesta.status, datos: respuesta.data });
				} catch (error) {

					let errorFedicom = new ErrorFedicom(error);

					postTransmision.log.info('La llamada al sistema externo ha fallado:', errorFedicom.getErrores());
					this.log.warn('La llamada al sistema externo ha fallado:', errorFedicom.getErrores());

					return new ResultadoTransmisionLigera(200, { errores: errorFedicom.getErrores() });
				}

			} else {

				if (!this.modificaciones.generaUnClon()) {
					let crcOriginal = postTransmision.getDatos()?.pedido?.crc;
					this.log.debug(`Se fuerza que aparezca el CRC del pedido original '${crcOriginal}'.`);
					this.modificaciones.fuezaCrcConcreto(crcOriginal);
				}

				let reTransmision = await Transmision.ejecutar(req, res, TransmisionCrearPedido, {
					opcionesDeReejecucion: this.modificaciones
				})


				if (this.modificaciones.generaUnClon()) {
					// Actualizamos la transmision original, indicando la nueva retransmisión que se ha hecho sobre la misma
					postTransmision.log.info(`Se ha clonado la transmisión con ID '${reTransmision.txId}' como resultado`);
					postTransmision.setMetadatosOperacion('pedido.clones', reTransmision.txId, '$push');
					postTransmision.actualizarTransmision();
				} else {
					postTransmision.log.info(`Generada transmisión con ID '${reTransmision.txId}' como resultado`);
				}

			}

			return new ResultadoTransmisionLigera(200, res);
		} catch (error) {
			this.log.err(error);
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}





TransmisionReejecutarPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: false,
	grupoRequerido: 'FED3_RETRANSMISION',
	simulaciones: false,
	simulacionesEnProduccion: false
});


module.exports = TransmisionReejecutarPedido;