'use strict';
const C = global.C;
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const IntercambioSap = require('modelos/transmision/IntercambioSap');
const InterComunicador = require('interfaces/InterComunicador');


/**
 * Devuelve la configuración del destino SAP
 */
class TxMonDestinosSap extends TransmisionLigera {


	// @Override
	async operar() {
		try {
			let respuesta = C.sap.destino.describirSistema()
			return new ResultadoTransmisionLigera(200, respuesta);
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}

	}

}


TxMonDestinosSap.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonDestinosSap;