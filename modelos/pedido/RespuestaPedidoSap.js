'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
//const iFlags = require('interfaces/iflags/iFlags');
const ErrorFedicom = require('modelos/ErrorFedicom');

// Modelos
const LineaPedidoSap = require('./LineaPedidoSap');


class RespuestaPedidoSap {

	#transmision;
	#log;

	#metadatos = {
		pedidoProcesadoSap: false,
		puntoEntrega: null,
		tipoPedidoSap: null,
		motivoPedidoSap: null,
		clienteSap: null,
		pedidosAsociadosSap: null,
		pedidoAgrupadoSap: null,
		pedidoDuplicadoSap: false,
		reboteFaltas: false,
		porRazonDesconocida: false,
		pedidoProcesadoSinNumero: false,
		erroresGraves: new ErrorFedicom(),
		servicioDemorado: false,
		estupefaciente: false,
		totales: {
			lineas: 0,
			cantidad: 0,
			lineasIncidencias: 0,
			cantidadIncidencias: 0,
			lineasEstupe: 0,
			cantidadEstupe: 0
		}
	}

	#datos = {
		//codigoCliente: null,
		notificaciones: null,
		direccionEnvio: null,
		codigoAlmacenServicio: null,
		//numeroPedidoOrigen: null,
		//tipoPedido: null,
		//fechaPedido: null,
		//fechaServicio: null,
		//aplazamiento: null,
		empresaFacturadora: null,
		observaciones: null,
		incidencias: null,
		lineas: [],
		alertas: null
	}

	constructor(transmision) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;

		let json = this.#transmision.sap.getRespuesta();

		this.#log.trace('Creando objeto de respuesta de pedido SAP con los datos obtenidos');

		this.#metadatos.pedidoProcesadoSap = json.sap_pedidoprocesado || false;
		this.#metadatos.puntoEntrega = json.sap_punto_entrega || null;
		this.#metadatos.tipoPedidoSap = json.sap_tipopedido || null;
		this.#metadatos.motivoPedidoSap = json.sap_motivopedido || null;
		this.#metadatos.clienteSap = json.sap_cliente || null;
		this.#metadatos.pedidoAgrupadoSap = parseInt(json.numeropedido) || null;

		if (Array.isArray(json.sap_pedidosasociados) && json.sap_pedidosasociados.length > 0) {
			this.#metadatos.pedidosAsociadosSap = []
			json.sap_pedidosasociados.forEach(numeroPedidoSap => {
				let pedidoInt = parseInt(numeroPedidoSap);
				if (pedidoInt) this.#metadatos.pedidosAsociadosSap.push(pedidoInt);
			})

			if (this.#metadatos.pedidosAsociadosSap.length === 0)
				this.#metadatos.pedidosAsociadosSap = null;
		}


		//this.codigoCliente = json.codigocliente || null;
		this.#datos.notificaciones = json.notificaciones?.length > 0 ? json.notificaciones : null;
		this.#datos.direccionEnvio = json.direccionenvio || null;
		this.#datos.codigoAlmacenServicio = json.codigoalmacenservicio || null;
		//this.numeroPedidoOrigen = json.numeropedidoorigen || null;
		//this.tipoPedido = json.tipopedido || null;
		//this.fechaPedido = Date.toFedicomDateTime();
		//this.fechaServicio = json.fechaservicio || null;
		//this.aplazamiento = json.aplazamiento || null;
		this.#datos.empresaFacturadora = json.empresafacturadora || null;
		this.#datos.observaciones = json.observaciones || null;
		this.#datos.alertas = json.alertas?.length > 0 ? json.alertas : null;
		this.#procesarIncidenciasSap(json.incidencias);
		this.#extraerLineas(json.lineas);

		if (this.#metadatos.pedidoProcesadoSap && !this.#metadatos.pedidosAsociadosSap) {
			this.#log.err('SAP dice que el pedido ha sido grabado, pero no indica el número de pedido')
			this.#metadatos.pedidoProcesadoSinNumero = true;
			this.#metadatos.erroresGraves.insertar('PED-ERR-999', 'SAP no ha podido grabar el pedido');
		}

	}


	#procesarIncidenciasSap(incidenciasJson) {

		if (Array.isArray(incidenciasJson) && incidenciasJson?.length > 0) {

			let incidenciasCabeceraSap = new ErrorFedicom();

			this.#log.warn('SAP ha devuelto incidencias en la cabecera:', incidenciasJson);
			incidenciasJson.filter(inc => {
				/**
				 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Pedido duplicado"}
				 */
				if (!inc.codigo && inc.descripcion === 'Pedido duplicado') {
					this.#log.debug('Detectada incidencia de "Pedido Duplicado" en SAP');
					this.#metadatos.pedidoDuplicadoSap = true;
					return false;
				}

				/**
				 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Por razon desconocida"}
				 */
				if (!inc.codigo && inc.descripcion === 'Por razon desconocida') {
					this.#log.debug('Detectada incidencia de "Por razon desconocida" en SAP');
					this.#metadatos.erroresGraves.insertar('PED-ERR-999', 'Los datos del tipo de pedido son incorrectos');
					this.#metadatos.porRazonDesconocida = true;
					return false;
				}

				return Boolean(inc.descripcion);
			}).forEach(inc => {
				incidenciasCabeceraSap.insertar(inc.codigo || 'PED-ERR-999', inc.descripcion)
			});

			this.#datos.incidencias = incidenciasCabeceraSap.getErrores();

		}




	}

	#extraerLineas(lineasJson) {
		// Extracción de información de las lineas
		if (!Array.isArray(lineasJson) || lineasJson.length === 0) {
			this.#log.fatal('SAP no ha devuelto líneas');
			return;
		}

		lineasJson.forEach((linea, i) => {
			let lineaSap = new LineaPedidoSap(linea, this.#transmision, i);
			this.#datos.lineas.push(lineaSap);

			lineaSap.gestionarReboteFaltas(this.#datos.codigoAlmacenServicio);

			this.#metadatos.totales.lineas++;
			this.#metadatos.totales.cantidad += lineaSap.cantidad;

			if (lineaSap.tieneIncidencias()) {
				this.#metadatos.totales.lineasIncidencias++;
				this.#metadatos.totales.cantidadIncidencias += lineaSap.cantidadFalta;
			}

			if (lineaSap.tieneEstupefaciente()) {
				this.#metadatos.estupefaciente = true;
				this.#metadatos.totales.lineasEstupe++;
				this.#metadatos.totales.cantidadEstupe += lineaSap.cantidad;
			}

			if (lineaSap.tieneServicioDemorado())
				this.#metadatos.servicioDemorado = true;
			return lineaSap;
		});
	}



	/**
	 * Devuelve un ErrorFedicom si la respuesta de SAP contiene errores graves que indican que el pedido,
	 * aunque haya pasado el chequeo de disponibilidad, no va a generarse en SAP.
	 * Un motivo de esto es el caso en el que SAP devuelve la incidencia 'Por razon desconocida'
	 * @returns 
	 */
	erroresGraves() {
		if (this.#metadatos.erroresGraves.tieneErrores())
			return this.#metadatos.erroresGraves;
		return null;
	}

	getDatos() {
		return this.#datos;
	}

	getMetadatos() {
		return this.#metadatos;
	}

	determinarEstadoTransmision() {

		const Tupla = function (estado, codigoHttp) {
			return {
				estadoTransmision: estado,
				codigoRetornoHttp: codigoHttp
			}
		}

		if (this.#metadatos.pedidoProcesadoSinNumero) {
			return Tupla(K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP, 500);
		}
		if (this.#metadatos.porRazonDesconocida) {
			return Tupla(K.ESTADOS.PEDIDO.RECHAZADO_SAP, 400);
		}

		if (this.#metadatos.pedidoProcesado) {
			return Tupla(K.ESTADOS.COMPLETADO, 201);
		} else {
			return Tupla(K.ESTADOS.PEDIDO.ESPERANDO_NUMERO_PEDIDO, 201);
		}

	}





}




module.exports = RespuestaPedidoSap;
