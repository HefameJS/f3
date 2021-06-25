'use strict';
const K = global.K;
const ErrorFedicom = require('modelos/ErrorFedicom');
const Modelo = require('modelos/transmision/Modelo');
const LineaPedidoSap = require('./LineaPedidoSap');


class RespuestaPedidoSap extends Modelo {

	metadatos = {
		errores: new ErrorFedicom(),
		erroresOcultados: new ErrorFedicom(),
		esRespuestaDeErrores: false,
		respuestaIncomprensible: false,
		clienteBloqueadoSap: false,
		pedidoProcesadoSap: false,
		puntoEntrega: null,
		tipoPedidoSap: null,
		motivoPedidoSap: null,
		clienteSap: null,
		pedidosAsociadosSap: [],
		pedidoAgrupadoSap: null,
		esPedidoDuplicadoSap: false,
		almacenDeRebote: false,
		porRazonDesconocida: false,
		pedidoProcesadoSinNumero: false,
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

	// Datos de la respuesta SAP, SANEADOS
	numeroPedido;
	codigoCliente;
	notificaciones;
	direccionEnvio;
	codigoAlmacenServicio;
	numeroPedidoOrigen;
	tipoPedido;
	fechaPedido;
	fechaServicio;
	aplazamiento;
	empresaFacturadora;
	observaciones;
	lineas;
	incidencias;
	alertas;


	constructor(transmision, numeroPedido) {
		super(transmision);

		let json = this.transmision.sap.getRespuesta();
		this.log.trace('Creando objeto de respuesta de pedido SAP con los datos obtenidos');


		if (Array.isArray(json)) {

			this.metadatos.esRespuestaDeErrores = true;

			this.log.warn('SAP devuelve un cuerpo de respuesta que es un array con errores de rechazo:', json);
			// Eliminamos las incidencias cuyo código comienza por 'SAP-IGN', ya que dan información sobre el bloqueo del cliente
			// y no queremos que esta información se mande al cliente.
			json.filter(incidencia => {
				if (incidencia?.codigo?.startsWith('SAP-IGN')) {
					this.metadatos.clienteBloqueadoSap = true;
					this.metadatos.erroresOcultados.insertar(incidencia);
					return false;
				}
				return true;
				// Para las incidencias que pasen el filtro, las añadimos a la lista de errores.
			}).forEach(incidencia => {
				this.metadatos.errores.insertar(incidencia.codigo || 'PED-ERR-999', incidencia.descripcion);
			});

			// Si el cliente está bloqueado, agregamos la incidencia de error de bloqueo en SAP y levantamos el Flag
			if (this.metadatos.clienteBloqueadoSap) {
				this.log.warn('SAP indica que el cliente tiene bloqueos de pedidos');
				this.metadatos.errores.insertar('PED-ERR-999', 'No se pudo guardar el pedido. Contacte con su comercial.');
			}
			return;
		}

		// BUG: En ocasiones, SAP devolvía un string que no era un JSON. Esto parece que ya no ocurre con el cambio a 'axios'
		// pero dejamos la comprobación por si acaso
		if (!json?.crc) {
			this.log.err('SAP devuelve un cuerpo de respuesta que no es un objeto válido. Se devuelve error de faltas simuladas', json);
			this.metadatos.respuestaIncomprensible = true;
			return;
		}


		if (numeroPedido) this.numeroPedido = numeroPedido;
		if (json.codigocliente) this.codigoCliente = json.codigocliente;
		if (Array.isArray(json.notificaciones) && json.notificaciones.length) this.notificaciones = json.notificaciones;
		if (json.direccionenvio) this.direccionEnvio = json.direccionenvio;
		if (json.codigoalmacenservicio) this.codigoAlmacenServicio = json.codigoalmacenservicio;
		if (json.numeropedidoorigen) this.numeroPedidoOrigen = json.numeropedidoorigen;
		if (json.tipopedido) this.tipoPedido = json.tipopedido;
		this.fechaPedido = Date.toFedicomDateTime();
		if (json.fechaservicio) this.fechaServicio = json.fechaservicio;
		if (json.aplazamiento) this.aplazamiento = json.aplazamiento;
		if (json.empresafacturadora) this.empresaFacturadora = json.empresafacturadora;
		if (json.observaciones) this.observaciones = json.observaciones;
		this.#procesarIncidenciasSap(json.incidencias);
		this.#extraerLineas(json.lineas);
		if (Array.isArray(json.alertas) && json.alertas.length) this.alertas = json.alertas;
		
		// Metadatos

		this.metadatos.pedidoProcesadoSap = json.sap_pedidoprocesado || false;
		this.metadatos.puntoEntrega = json.sap_punto_entrega || null;
		this.metadatos.tipoPedidoSap = json.sap_tipopedido || null;
		this.metadatos.motivoPedidoSap = json.sap_motivopedido || null;
		this.metadatos.clienteSap = json.sap_cliente || null;
		this.metadatos.pedidoAgrupadoSap = parseInt(json.numeropedido) || null;
		if (Array.isArray(json.sap_pedidosasociados) && json.sap_pedidosasociados.length) {
			let pedidosAsociadosSap = new Set();
			json.sap_pedidosasociados.forEach(numeroPedidoSap => {
				let pedidoInt = parseInt(numeroPedidoSap);
				if (pedidoInt) pedidosAsociadosSap.add(pedidoInt);
			})

			if (pedidosAsociadosSap.size)
				this.metadatos.pedidosAsociadosSap = Array.from(pedidosAsociadosSap);
		}

		if (this.metadatos.pedidoProcesadoSap && !this.metadatos.pedidosAsociadosSap) {
			this.log.err('SAP dice que el pedido ha sido grabado, pero no indica el número de pedido')
			this.metadatos.pedidoProcesadoSinNumero = true;
			this.metadatos.errores.insertar('PED-ERR-999', 'SAP no ha podido grabar el pedido');
		}

	}


	#procesarIncidenciasSap(incidenciasJson) {

		if (Array.isArray(incidenciasJson) && incidenciasJson?.length > 0) {

			let incidenciasCabeceraSap = new ErrorFedicom();

			this.log.warn('SAP ha devuelto incidencias en la cabecera:', incidenciasJson);
			incidenciasJson.filter(inc => {
				/**
				 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Pedido duplicado"}
				 */
				if (!inc.codigo && inc.descripcion === 'Pedido duplicado') {
					this.log.debug('Detectada incidencia de "Pedido Duplicado" en SAP');
					this.metadatos.esPedidoDuplicadoSap = true;
					return false;
				}

				/**
				 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Por razon desconocida"}
				 */
				if (!inc.codigo && inc.descripcion === 'Por razon desconocida') {
					this.log.debug('Detectada incidencia de "Por razon desconocida" en SAP');
					this.metadatos.errores.insertar('PED-ERR-999', 'El tipo de pedido es incorrecto');
					this.metadatos.porRazonDesconocida = true;
					return false;
				}

				return Boolean(inc.descripcion);
			}).forEach(inc => {
				incidenciasCabeceraSap.insertar(inc.codigo || 'PED-ERR-999', inc.descripcion)
			});

			this.incidencias = incidenciasCabeceraSap.getErrores();

		}




	}

	#extraerLineas(lineasJson) {
		// Extracción de información de las lineas
		if (!Array.isArray(lineasJson) || lineasJson.length === 0) {
			this.log.fatal('SAP no ha devuelto líneas');
			return;
		}

		this.lineas = lineasJson.map((linea, i) => {
			let lineaSap = new LineaPedidoSap(this.transmision, linea, i);
			
			lineaSap.gestionarReboteFaltas(this.codigoAlmacenServicio);
			if (lineaSap.metadatos.almacenDeRebote) {
				this.metadatos.almacenDeRebote = lineaSap.metadatos.almacenDeRebote
			}

			this.metadatos.totales.lineas++;
			this.metadatos.totales.cantidad += lineaSap.cantidad;
			if (lineaSap.tieneIncidencias()) {
				this.metadatos.totales.lineasIncidencias++;
				this.metadatos.totales.cantidadIncidencias += lineaSap.cantidadFalta;
			}
			if (lineaSap.metadatos.estupefaciente) {
				this.metadatos.estupefaciente = true;
				this.metadatos.totales.lineasEstupe++;
				this.metadatos.totales.cantidadEstupe += lineaSap.cantidad;
			}
			if (lineaSap.servicioDemorado) {
				this.metadatos.servicioDemorado = true;
			}

			return lineaSap;
		});
	}

	determinarEstadoTransmision() {

		const Tupla = function (estado, codigoHttp) {
			return {
				estadoTransmision: estado,
				codigoRetornoHttp: codigoHttp
			}
		}

		if (this.metadatos.pedidoProcesadoSinNumero) {
			return Tupla(K.ESTADOS.PEDIDO.SIN_NUMERO_PEDIDO_SAP, 500);
		}
		if (this.metadatos.porRazonDesconocida) {
			return Tupla(K.ESTADOS.PEDIDO.RECHAZADO_SAP, 400);
		}

		if (this.metadatos.pedidoProcesado) {
			return Tupla(K.ESTADOS.COMPLETADO, 201);
		} else {
			return Tupla(K.ESTADOS.PEDIDO.ESPERANDO_NUMERO_PEDIDO, 201);
		}

	}

	generarJSON() {

		if (this.metadatos.esRespuestaDeErrores) {
			return this.metadatos.errores.getErrores();
		}

		let json = {};
		if (this.numeroPedido) json.numeroPedido = this.numeroPedido;
		if (this.codigoCliente) json.codigoCliente = this.codigoCliente;
		if (this.notificaciones) json.notificaciones = this.notificaciones;
		if (this.direccionEnvio) json.direccionEnvio = this.direccionEnvio;
		if (this.codigoAlmacenServicio) json.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.numeroPedidoOrigen) json.numeroPedidoOrigen = this.numeroPedidoOrigen;
		if (this.tipoPedido) json.tipoPedido = this.tipoPedido;
		if (this.fechaPedido) json.fechaPedido = this.fechaPedido;
		if (this.fechaServicio) json.fechaServicio = this.fechaServicio;
		if (this.aplazamiento) json.aplazamiento = this.aplazamiento;
		if (this.empresaFacturadora) json.empresaFacturadora = this.empresaFacturadora;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.lineas) json.lineas = this.lineas.map(linea => linea.generarJSON());
		if (this.incidencias) json.incidencias = this.incidencias;
		if (this.alertas) json.alertas = this.alertas;

		return json;
	}

}




module.exports = RespuestaPedidoSap;
