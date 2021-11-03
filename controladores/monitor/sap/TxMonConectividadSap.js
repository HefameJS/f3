'use strict';
const C = global.C;
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const IntercambioSap = require('modelos/transmision/IntercambioSap');
const InterComunicador = require('interfaces/InterComunicador');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonConectividadSap extends TransmisionLigera {


	// @Override
	async operar() {

		let consultaLocal = (this.req.query.local !== undefined)

		if (consultaLocal) {

			let intercambioSap = new IntercambioSap(this);
			intercambioSap.setDevuelveEnCrudo(true);
			try {
				let antes = (new Date()).getTime()
				let respuestaSap = await intercambioSap.get('/sap/public/ping');
				let despues = (new Date()).getTime()

				let servidorSap = respuestaSap?.headers?.['x-servidor-sap'];
				let lagDeSapMicrosegundos = parseInt(respuestaSap?.headers?.['sap-perf-fesrec']);

				return new ResultadoTransmisionLigera(200, {
					alcanzado: respuestaSap.status,
					servidorSap,
					lagSapMs: lagDeSapMicrosegundos / 1000,
					rttMs: despues - antes
				});
			}
			catch (error) {
				return (new ErrorFedicom(error)).generarResultadoTransmision();
			}


		} else {

			let interComunicador = new InterComunicador(this)
			try {
				let respuesta = await interComunicador.llamadaTodosMonitores('/~/sap/ping?local')
				return new ResultadoTransmisionLigera(200, respuesta);
			} catch (error) {
				console.log('A LAPUTA', error)
				return (new ErrorFedicom(error)).generarResultadoTransmision();
			}
		}
	}

}


TxMonConectividadSap.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConectividadSap;