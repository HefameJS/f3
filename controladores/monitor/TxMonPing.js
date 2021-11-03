'use strict';

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');



/**
 * Sí, Un ping
 */
class TxMonPing extends TransmisionLigera {
	// @Override
	async operar() {
		return new ResultadoTransmisionLigera(200, { pong: true, fecha: new Date() });
	}
}


TxMonPing.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	admitirSinTokenVerificado: true
});


module.exports = TxMonPing;