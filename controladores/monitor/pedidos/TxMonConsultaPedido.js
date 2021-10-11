'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

class ModeloNodoPedido {
	#raw;

	es = {
		vigente: false,
		informado: false,
		interna: null,
		externa: null,
		rechazo: null,
		duplicado: null,
		relevante: null,
		estado: 'desconocido'
	}

	constructor(nodo) {
		this.#raw = nodo;
		this.es.interna = Boolean(nodo.pedido.esReejecucion);
		this.es.externa = Boolean(!nodo.pedido.esReejecucion);
		this.es.rechazo = Boolean(nodo.estado === K.ESTADOS.PEDIDO.RECHAZADO_SAP);
		this.es.duplicado = Boolean(nodo.pedido.esDuplicado);
		this.es.relevante = Boolean(!nodo.pedido.esPedidoDuplicadoSap && !this.es.rechazo && !this.es.duplicado);

		switch (nodo.estado) {
			case K.ESTADOS.DUPLICADO:
			case K.ESTADOS.PEDIDO.RECHAZADO_SAP:
				this.es.estado = 'warning';
				break;
			case K.ESTADOS.ERROR_CONCENTRADOR:
			case K.ESTADOS.PEDIDO.NO_SAP:
			case K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP:
				this.es.estado = 'error';
				break;
			case K.ESTADOS.RECEPCIONADO:
			case K.ESTADOS.PEDIDO.ESPERANDO_NUMERO_PEDIDO:
				this.es.estado = 'pendiente';
				break;
			case K.ESTADOS.COMPLETADO:
				this.es.estado = 'ok';
				break;
			default:
				this.es.estado = 'desconocido';
		}
	}

	getId() {
		return this.#raw._id;
	}

	getDatos() {
		let d = this.#raw;
		let p = d.pedido;
		let c = d.conexion;
		let cm = c.metadatos;

		let json = {
			id: d._id,
			version: d.v,
			estado: d.estado,
			fechaCreacion: d.fechaCreacion,
			errorComprobacionDuplicado: p.errorComprobacionDuplicado,
			porRazonDesconocida: p.porRazonDesconocida,
			pedidoProcesadoSap: p.pedidoProcesadoSap,
			clienteBloqueadoSap: p.clienteBloqueadoSap,
			esPedidoDuplicadoSap: p.esPedidoDuplicadoSap,
			esReejecucion: p.esReejecucion,
			opcionesDeReejecucion: p.opcionesDeReejecucion,
			concentrador: cm.concentrador,
			es: this.es
		}

		if (d.sap) {
			json.sap = d.sap.metadatos;
		}

		if (this.es.informado) {
			json.noEnviaFaltas = p.noEnviaFaltas;
			json.retransmisionCliente = p.retransmisionCliente;
			json.erroresOcultados = p.erroresOcultados;
			json.ip = cm.ip;
			json.autenticacion = cm.autenticacion;
			json.programa = cm.programa;
			json.ssl = cm.ssl;
			json.balanceador = cm.balanceador;
			json.transmision = {
				solicitud: c.solicitud,
				respuesta: c.respuesta
			}
		}

		if (this.es.vigente) {
			json.codigoCliente = p.codigoCliente;
			json.numeroPedidoOrigen = p.numeroPedidoOrigen;
			json.crc = p.crc;
			json.tipoCrc = p.tipoCrc;

			json.codigoAlmacenServicio = p.codigoAlmacenServicio;
			json.codigoAlmacenDesconocido = p.codigoAlmacenDesconocido;
			json.codigoAlmacenSaneado = p.codigoAlmacenSaneado;
			json.reboteFaltas = p.reboteFaltas;
			json.almacenesDeRebote = p.almacenesDeRebote;

			json.servicioDemorado = p.servicioDemorado;
			json.estupefaciente = p.estupefaciente;
			json.esTransfer = p.esTransfer;

			json.totales = p.totales;
			json.puntoEntrega = p.puntoEntrega;

			json.tipoPedidoSap = p.tipoPedidoSap;
			json.motivoPedidoSap = p.motivoPedidoSap;
			json.clienteSap = p.clienteSap;
			json.pedidosAsociadosSap = p.pedidosAsociadosSap;
			json.pedidoAgrupadoSap = p.pedidoAgrupadoSap;
		}
		return json;
	}
}

class ModeloPedido {

	#nodos = [];
	#nodoVigente;
	#nodoInformado;

	constructor(nodos) {
		this.#nodos = nodos.map(nodo => new ModeloNodoPedido(nodo))
		this.#nodos.forEach(nodo => {
			if (nodo.es.externa) {
				if (nodo.es.relevante || !this.#nodoInformado) {
					this.#nodoInformado = nodo;
				}
			}
			if (nodo.es.relevante || !this.#nodoVigente) {
				this.#nodoVigente = nodo;
			}
		})

		if (this.#nodoVigente) this.#nodoVigente.es.vigente = true;
		if (this.#nodoInformado) this.#nodoInformado.es.informado = true;
	}

	getDatos() {
		return this.#nodos.map(nodo => nodo.getDatos())
	}

	getIdNodoVigente() {
		return this.#nodoVigente?.getId();
	}

}

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
		let opciones = { sort: { fechaCreacion: 1 } }

		let nodos = await M.col.transmisiones.find(filtro, opciones).toArray();
		let pedido = new ModeloPedido(nodos);

		return new ResultadoTransmisionLigera(200, pedido.getDatos());
	}
}


TxMonConsultaPedido.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaPedido;
