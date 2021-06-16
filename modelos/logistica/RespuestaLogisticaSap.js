'use strict';
//const C = global.config;
const K = global.constants;

const Modelo = require('modelos/transmision/Modelo');
const ErrorFedicom = require('modelos/ErrorFedicom');

const DireccionLogistica = require('modelos/logistica/DireccionLogistica');
const LineaLogisticaSap = require('modelos/logistica/LineaLogisticaSap');



class RespuestaLogisticaSap extends Modelo {

	metadatos = {
		errores: new ErrorFedicom(),
		erroresOcultados: new ErrorFedicom(),

		esRespuestaDeErrores: false,
		clienteBloqueadoSap: false,
		respuestaIncomprensible: false,

		puntoEntrega: null,
		totales: {
			lineas: 0,
			lineasIncidencias: 0,
			cantidad: 0,
			cantidadIncidencias: 0
		}
	}

	// Datos SANEADOS de la respuesta SAP. 
	codigoCliente;
	numeroLogistica;
	numeroLogisticaOrigen;
	tipoLogistica;
	fechaLogistica;
	fechaRecogidaSolicitada;
	origen;
	destino;
	observaciones;
	servicio;
	lineas;
	incidencias;

	constructor(transmision) {
		super(transmision);

		let json = this.transmision.sap.getRespuesta();

		this.log.debug('Analizando objeto de respuesta de logística SAP con los datos obtenidos');

		// Si la respuesta de SAP es un array de incidencias, la petición esta rechazada por SAP
		// Sanearemos las mismas por si vienen errores de bloqueos.
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
			// Para las incidencias que pasen el filtro, las insertamos en la lista de errores.
			}).forEach(incidencia => {
				this.metadatos.errores.insertar(incidencia)
			});

			// Si el cliente está bloqueado, agregamos la incidencia de error de bloqueo en SAP y levantamos el Flag
			if (this.metadatos.clienteBloqueadoSap) {
				this.log.warn('SAP indica que el cliente tiene bloqueos de pedidos');
				this.metadatos.errores.insertar('LOG-ERR-999', 'No se pudo guardar el pedido de logística. Contacte con su comercial.');
			}

			return;
		}

		if (!json) {
			this.log.err('SAP ha devuelto un cuerpo de respuesta que no es un objeto válido', json);
			this.metadatos.respuestaIncomprensible = true;
			return;
		}

		if (json.sap_punto_entrega) this.metadatos.puntoEntrega = json.sap_punto_entrega;

		this.codigoCliente = json.codigocliente || null;
		this.numeroLogistica = json.numerologistica || null;
		this.numeroLogisticaOrigen = json.numerologisticaorigen || null;
		this.tipoLogistica = json.tipologistica || null;
		this.origen = new DireccionLogistica(this.transmision, json.origen, 'origen');
		this.destino = new DireccionLogistica(this.transmision, json.destino, 'destino');
		this.fechaLogistica = Date.toFedicomDateTime();
		this.fechaRecogidaSolicitada = json.fecharecogidasolicitada || null;
		this.observaciones = json.observaciones || null;
		this.servicio = json.servicio || null;

		this.#extraerLineas(json.lineas);
		this.#sanearIncidenciasSap(json.incidencias);

	}

	#extraerLineas(lineasJson) {
		if (Array.isArray(lineasJson) && lineasJson.length) {
			this.lineas = lineasJson.map((linea, index) => {
				let lineaSap = new LineaLogisticaSap(this.transmision, linea, index);

				this.metadatos.totales.lineas++;
				if (lineaSap.cantidad) this.metadatos.totales.cantidad += lineaSap.cantidad;

				if (lineaSap.incidencias) {
					this.metadatos.totales.lineasIncidencias++;
					this.metadatos.totales.cantidadIncidencias += lineaSap.cantidad;
				}

				return lineaSap;
			});
		}
	}

	#sanearIncidenciasSap(incidenciasJson) {
		if (Array.isArray(incidenciasJson) && incidenciasJson.length) {
			this.log.debug('Saneando incidencias devueltas por SAP en la cabecera', incidenciasJson);
			this.incidencias = incidenciasJson
				.filter(inc => {
					if (inc.descripcion) return true;
					this.log.warn('Se descarta la incidencia devuelta por SAP por no tener descripción', inc);
					return false;
				})
				.map(inc => {
					return {
						codigo: inc.codigo || 'LOG-ERR-999',
						descripcion: inc.descripcion
					}
				});
		}
	}

	esRespuestaDeErrores() {
		return this.metadatos.esRespuestaDeErrores;
	}

	esRespuestaIncompresible() {
		return this.metadatos.respuestaIncomprensible;
	}

	determinarEstadoTransmision() {
		if (this.metadatos.esRespuestaDeErrores) {
			return K.ESTADOS.LOGISTICA.RECHAZADO_SAP;
		}

		if (this.metadatos.respuestaIncomprensible) {
			return K.ESTADOS.ERROR_RESPUESTA_SAP;
		}

		if (this.numeroLogistica) {
			return K.ESTADOS.COMPLETADO;
		} else {
			return K.ESTADOS.LOGISTICA.SIN_NUMERO_LOGISTICA;
		}
	}

	generarJSON() {

		if (this.metadatos.esRespuestaDeErrores) {
			return this.metadatos.errores;
		}

		let json = {};

		if (this.codigoCliente) json.codigoCliente = this.codigoCliente;
		if (this.numeroLogistica) json.numeroLogistica = this.numeroLogistica;
		if (this.numeroLogisticaOrigen) json.numeroLogisticaOrigen = this.numeroLogisticaOrigen;
		if (this.tipoLogistica) json.tipoLogistica = this.tipoLogistica;
		if (this.origen) json.origen = this.origen.generarJSON();
		if (this.destino) json.destino = this.destino.generarJSON();
		if (this.fechaLogistica) json.fechaLogistica = this.fechaLogistica;
		if (this.fechaRecogidaSolicitada) json.fechaRecogidaSolicitada = this.fechaRecogidaSolicitada;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.servicio) json.servicio = this.servicio;
		if (this.lineas) json.lineas = this.lineas.map(linea => linea.generarJSON());
		if (this.incidencias) json.incidencias = this.incidencias;

		return json;
	}


}




module.exports = RespuestaLogisticaSap;
