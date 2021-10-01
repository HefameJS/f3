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



		let parametroCrc = this.req.params?.crc;
		this.log.info(`Solicitud de consulta de pedido con CRC ${parametroCrc}`);


		if (!M.ObjectID.isValid(parametroCrc)) {
			this.log.warn(`El número de pedido indicado '${parametroCrc}' no es un ObjectID válido`);
			let error = new ErrorFedicom('MON-400', 'El número del pedido no es válido', 400);
			return error.generarResultadoTransmision();
		}

		let crc = M.ObjectID.createFromHexString(parametroCrc);
		let filtro = {			'pedido.crc': crc		}

		let opciones = {
			sort: {
				fechaCreacion: 1,
			}
		}

		let nodos = await M.col.transmisiones.find(filtro, opciones).toArray();
		return new ResultadoTransmisionLigera(200, nodos);

	}

}


TxMonConsultaPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaPedido;