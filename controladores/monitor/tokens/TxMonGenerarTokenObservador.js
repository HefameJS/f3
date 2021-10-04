'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const Token = require('modelos/transmision/Token');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonGenerarTokenObservador extends TransmisionLigera {


	// @Override
	async operar() {

		this.log.info('Solicitud de generación de token de observador');

		try {
			let jwt = Token.generarToken('Observador', K.DOMINIOS.MONITOR, { permanente: true });
			let cuerpoRespuesta = {
				auth_token: jwt, // Se manda 'auth_token' para que el campo se llame igual que el del protocolo Fedicom3
				datos: Token.extraerDatosToken(jwt)
			}
			return new ResultadoTransmisionLigera(200, cuerpoRespuesta);
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonGenerarTokenObservador.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: true
});


module.exports = TxMonGenerarTokenObservador;