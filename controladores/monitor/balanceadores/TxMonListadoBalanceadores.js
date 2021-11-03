'use strict';

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonListadoBalanceadores extends TransmisionLigera {


	// @Override
	async operar() {
		let tipoBalanceador = this.req.query.tipo || null;

		this.log.info(`Listado de balanceadores [tipo=${tipoBalanceador}]`);

		

		try {

			let balanceadores = C.balanceador.balanceadores;
			if (tipoBalanceador) balanceadores = balanceadores.filter(balanceador => balanceador.tipo === tipoBalanceador);

			this.log.info('Buscando información de los balanceadores', balanceadores);
			let promesas = balanceadores.map(balanceador => balanceador.consultaEstado(this));

			let resultados = await Promise.allSettled(promesas);

			resultados = resultados.map(resultado => {
				return resultado.value || resultado.reason;
			})

			return new ResultadoTransmisionLigera(200, resultados);
			
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonListadoBalanceadores.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_BALANCEADOR'
});


module.exports = TxMonListadoBalanceadores;