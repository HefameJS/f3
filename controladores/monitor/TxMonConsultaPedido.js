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
		let filtro = { 'pedido.crc': crc }

		let opciones = {
			sort: {
				fechaCreacion: 1,
			}
		}

		let nodos = await M.col.transmisiones.find(filtro, opciones).toArray();

		let nodoVigente = null;
		let nodoInformado = null;

		nodos.forEach(nodo => {
			nodo.es = {
				vigente: false,
				informado: false
			};

			nodo.es.interna = nodo.pedido.esReejecucion;
			nodo.es.externa = !nodo.pedido.esReejecucion;
			nodo.es.rechazo = nodo.estado === K.ESTADOS.PEDIDO.RECHAZADO_SAP;
			nodo.es.duplicado = nodo.pedido.esDuplicado || nodo.pedido.esPedidoDuplicadoSap || false;
			nodo.es.relevante = !nodo.es.rechazo && !nodo.es.duplicado;

			switch (nodo.estado) {
				case K.ESTADOS.DUPLICADO:
				case K.ESTADOS.PEDIDO.RECHAZADO_SAP:
					nodo.es.estado = 'warning';
					break;
				case K.ESTADOS.ERROR_CONCENTRADOR:
				case K.ESTADOS.PEDIDO.NO_SAP:
				case K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP:
					nodo.es.estado = 'error';
					break;
				case K.ESTADOS.RECEPCIONADO:
				case K.ESTADOS.PEDIDO.ESPERANDO_NUMERO_PEDIDO:
					nodo.es.estado = 'pendiente';
					break;
				case K.ESTADOS.COMPLETADO:
					nodo.es.estado = 'ok'; 
					break;
				default:
					nodo.es.estado = 'desconocido';
			}


			if (nodo.es.externa) {
				if (nodo.es.relevante || !nodoInformado) {
					nodoInformado = nodo;
				}
			}
			if (nodo.es.relevante || !nodoVigente) {
				nodoVigente = nodo;
			}
		})

		if (nodoVigente) nodoVigente.es.vigente = true;
		if (nodoInformado) nodoInformado.es.informado = true;

		return new ResultadoTransmisionLigera(200, nodos);

	}

}


TxMonConsultaPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaPedido;
