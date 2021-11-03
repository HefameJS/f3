'use strict';
const C = global.C;
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonConsultaBalanceador extends TransmisionLigera {


	// @Override
	async operar() {
		let nombreBalanceador = this.req.params.nombreBalanceador || null;
		this.log.info(`Consulta de balanceador [nombre=${nombreBalanceador}]`);
		if (!nombreBalanceador) {
			this.log.warn('No se indica el nombre del balanceador')
			return (new ErrorFedicom('HTTP-400', 'Debe indicar el nombre del concentrador', 400)).generarResultadoTransmision();
		}


		let balanceador = C.balanceador.get(nombreBalanceador);
		if (!balanceador) {
			this.log.warn('El balanceador indicado no está definido en la configuración')
			return (new ErrorFedicom('HTTP-404', 'El balanceador indicado no existe', 404)).generarResultadoTransmision();
		}

		try {
			let resultado = await balanceador.consultaEstado(this);
			return new ResultadoTransmisionLigera(200, resultado);
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonConsultaBalanceador.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_BALANCEADOR'
});


module.exports = TxMonConsultaBalanceador;