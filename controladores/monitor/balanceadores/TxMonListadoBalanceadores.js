'use strict';

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const Token = require('modelos/transmision/Token');
const InterComunicador = require('interfaces/InterComunicador');


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
				return {
					ok: resultado.status === 'fulfilled',
					resultado: resultado.value || resultado.reason?.message
				}
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