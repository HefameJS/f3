'use strict';

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const Token = require('modelos/transmision/Token');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonGenerarTokenPermanente extends TransmisionLigera {


	// @Override
	async operar() {

		this.log.info('Solicitud de generación de token permanente');

		let peticionGenerarToken = this.req.body;
		let errorPeticion = new ErrorFedicom();
		if (!peticionGenerarToken?.usuario) errorPeticion.insertar('API-400', 'No se ha especificado el usuario', 400);
		if (!peticionGenerarToken?.dominio) errorPeticion.insertar('API-400', 'No se ha especificado el dominio', 400);
		if (errorPeticion.tieneErrores()) {
			return errorPeticion.generarResultadoTransmision()
		}


		this.log.info(`Se procede a la generación de un token permanente. [usuario=${peticionGenerarToken.usuario}, dominio=${peticionGenerarToken.dominio}]`);

		try {
			let jwt = Token.generarToken(peticionGenerarToken.usuario, peticionGenerarToken.dominio, { permanente: true });
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


TxMonGenerarTokenPermanente.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_TOKENS'
});


module.exports = TxMonGenerarTokenPermanente;