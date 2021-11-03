'use strict';
const C = global.C;
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const Token = require('modelos/transmision/Token');
const InterComunicador = require('interfaces/InterComunicador');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonConsultaBalanceador extends TransmisionLigera {


	// @Override
	async operar() {
		let nombreBalanceador = this.req.params.nombreBalanceador || null;

		this.log.info(`Consulta de balanceador [tipo=${nombreBalanceador}]`);

		try {
			let balanceador = C.balanceador.get(nombreBalanceador);
			let resultado = await balanceador.consultaEstado(new InterComunicador(this));
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