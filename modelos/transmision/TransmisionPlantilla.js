'use strict';
//const C = global.config;
//const L = global.logger;
const K = global.constants;
//const M = global.mongodb;


const Transmision = require('modelos/transmision/Transmision');
const ResultadoTransmision = require('modelos/transmision/ResultadoTransmision');
const CondicionesAutorizacion = require('./CondicionesAutorizacion');

/**
 * 
 */
class TransmisionPlantilla extends Transmision {

	static async instanciar(req, res) {
		let transmision = new TransmisionPlantilla(req, res);
		await transmision.registrarTransmision();
		await transmision.inicializar();
		return transmision;
	}

	constructor(req, res) {
		super(req, res, Transmision.TIPOS.XXXXXXXXX, TransmisionPlantilla.condicionesAutorizacion);
		// Los atributos se inicializan en inicializar() [opcionalmente de manera asíncrona]
		// ya que un constructor no puede ser asíncrono.
	}
	async inicializar() {
		this.foo = 'bar';
	}

	async operar() {

		let resultado = new ResultadoTransmision(200, K.ESTADOS.COMPLETADO, { ok: 'vale tronco' });

		await this.responder({ ok: 'vale tron' });

		resultado.responderTransmision(this);
		// O LO QUE ES LO MISMO:
		//await this.responder(resultadoTransmision.cuerpoRespuestaHttp, resultadoTransmision.codigoEstadoHttp);
		//this.setEstado(resultadoTransmision.codigoEstadoTransmision);

		this.setMetadatosOperacion('plantilla', { meta: 'datos' });
		await this.actualizarTransmision();
	}


}

TransmisionPlantilla.procesar = async function (req, res) {
	let transmision = await TransmisionPlantilla.instanciar(req, res);
	await transmision.operar();
}


TransmisionPlantilla.condicionesAutorizacion = new CondicionesAutorizacion({
	tokenVerificado: true,
	grupo: null,
	simulaciones: false,
	simulacionesEnProduccion: false,
	simulacionRequiereCambioToken: false
});


module.exports = TransmisionPlantilla;