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
class TxMonConsultaPedido extends TransmisionLigera {


	// @Override
	async operar() {

		this.log.info('Solicitud de consulta de pedido');

		try {
			let parametroCrc = this.req.params?.crc;


			if (!M.ObjectID.isValid(parametroCrc)) {
				this.log.warn(`El número de pedido indicado '${parametroCrc}' no es un ObjectID válido`);
				let error = new ErrorFedicom('MON-400', 'El número del pedido no es válido', 400);
				return error.generarResultadoTransmision();
			}

			let crc = M.ObjectID.createFromHexString(parametroCrc);

			let filtro = {
				'pedido.crc': crc
			}

			let opciones = {
				projection: {
					_id: 1,
					estado: 1,
					fechaCreacion: 1,
					tipo: 1,
					v: 1,
					pedido: 1
				},
				sort: {
					fechaCreacion: 1,
				}
			}


			let transmisiones = await M.db.collection('transmisiones').find(filtro, opciones).toArray();
			return new ResultadoTransmisionLigera(200, transmisiones);
		} catch (error) {
			this.log.err(error);
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonConsultaPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaPedido;