'use strict';
const M = global.M;

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonBorrarRegistroInstancia extends TransmisionLigera {


	// @Override
	async operar() {

		this.log.info('Solicitud de generación de token permanente');

		let idInstancia = this.req.params.idInstancia;
		if (idInstancia) {

		}
		this.log.info(`Se procede a borrar los datos de registro de la instancia '${idInstancia}'.`);

		console.log(idInstancia);

		try {
			let respuestaMongo = await M.bd.collection('instancias').deleteOne({ _id: idInstancia })
			console.log(respuestaMongo)
			let cuerpoRespuesta = {
				ok: true
			}
			return new ResultadoTransmisionLigera(200, cuerpoRespuesta);
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonBorrarRegistroInstancia.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_INSTANCIAS'
});


module.exports = TxMonBorrarRegistroInstancia;