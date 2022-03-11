'use strict';
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
		ultimoNodoCliente: false,
		estado: 'desconocido'
	}

	constructor(nodo) {
		this.#raw = nodo;
		this.es.interna = Boolean(nodo.pedido.esReejecucion);
		this.es.externa = Boolean(!nodo.pedido.esReejecucion);
		this.es.rechazo = Boolean(nodo.estado === K.ESTADOS.PEDIDO.RECHAZADO_SAP);
		this.es.duplicado = Boolean(nodo.pedido.esDuplicado);
		this.es.relevante = Boolean(/*!nodo.pedido.esPedidoDuplicadoSap &&*/ !this.es.rechazo && !this.es.duplicado);

		switch (nodo.estado) {
			case K.ESTADOS.DUPLICADO:
			case K.ESTADOS.PEDIDO.RECHAZADO_SAP:
				this.es.estado = 'warning';
				break;
			case K.ESTADOS.ERROR_CONCENTRADOR:
			case K.ESTADOS.ERROR_RESPUESTA_SAP:
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

	get id() {
		return this.#raw._id;
	}

	get estado() {
		return this.#raw.estado;
	}

	get cuerpoRespuestaCliente() {
		return this.#raw.conexion?.respuesta?.body;
	}
	get codigoEstadoRespuestaCliente() {
		return this.#raw.conexion?.respuesta?.estado;
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

		if (this.es.externa || p.opcionesDeReejecucion?.clonado) {
			json.noEnviaFaltas = p.noEnviaFaltas;
			json.retransmisionCliente = p.retransmisionCliente;
			json.erroresOcultados = p.erroresOcultados;
			json.ip = cm.ip;
			json.autenticacion = cm.autenticacion;
			json.programa = cm.programa;
			json.ssl = cm.ssl;
			json.balanceador = cm.balanceador;
		}
		if (this.es.informado || this.es.ultimoNodoCliente) {
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

			json.tipoPedido = p.tipoPedido;
			json.tipoPedidoSap = p.tipoPedidoSap;
			json.motivoPedidoSap = p.motivoPedidoSap;
			json.clienteSap = p.clienteSap;
			json.pedidosAsociadosSap = p.pedidosAsociadosSap;
			json.pedidoAgrupadoSap = p.pedidoAgrupadoSap;
			json.transmision = {
				solicitud: c.solicitud,
				respuesta: c.respuesta
			}
		}
		return json;
	}
}


module.exports = ModeloNodoPedido;