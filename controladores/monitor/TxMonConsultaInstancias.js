'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TxMonConsultaProcesos extends TransmisionLigera {

	
	// @Override
	async operar() {

		this.log.info('Solicitud de consulta de instancias');

		try {
			let instancias = await M.db.collection('instancias').find().toArray();
			return new ResultadoTransmisionLigera(200,  instancias);
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonConsultaProcesos.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	llamadaMonitor: true
	// grupoRequerido: 'MIS COJONES'
});


module.exports = TxMonConsultaProcesos;