'use strict';

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const Maestro = require('global/maestros/Maestro');


/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TxMonConsultaMaestro extends TransmisionLigera {


	// @Override
	async operar() {

		

		let parametroMaestro = this.req.params?.idMaestro?.toLowerCase?.();
		let parametroElemento = this.req.params?.idElemento;

		this.log.info(`Consulta de maestro [maestro=${parametroMaestro}, elemento=${parametroElemento}]`);
		let maestro = Maestro[parametroMaestro];
		let respuesta = null;
		if (!maestro) respuesta = new ErrorFedicom('HTTP-404', 'No existe la página solicitada')
		else if (parametroElemento) respuesta = await maestro.porNombre(parametroElemento);
		else respuesta = await maestro.lista();
		return new ResultadoTransmisionLigera(200, respuesta);
	}

}


TxMonConsultaMaestro.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaMaestro;