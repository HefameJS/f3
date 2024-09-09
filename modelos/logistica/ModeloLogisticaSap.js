'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iflags/iFlags');
const DireccionLogistica = require('./ModeloDireccionLogistica');

// Modelos
const LineaLogisticaSap = require('./ModeloLineaLogisticaSap');


class LogisticaSap {

	constructor(json, txId) {

		this.txId = txId;
		L.xt(txId, ['Instanciando objeto LogisticaSap con los datos del cuerpo HTTP', json]);

		this.metadatos = {
			puntoEntrega: json.sap_punto_entrega || null,
			cliente: parseInt(json.codigocliente?.slice(-5)) || null,
			numeroLogistica: parseInt(json.numerologistica) || null,
			totales: {
				lineas: 0,
				lineasIncidencias: 0,
				cantidad: 0,
				cantidadIncidencias: 0
			}
		}


		this.codigoCliente = json.codigocliente || null;
		this.numeroLogistica = json.numerologistica || null;
		this.numeroLogisticaOrigen = json.numerologisticaorigen || null;

		this.tipoLogistica = json.tipologistica || null;
		this.fechaLogistica = Date.toFedicomDateTime();
		this.fechaRecogidaSolicitada = json.fecharecogidasolicitada || null;

		this.origen = new DireccionLogistica(txId, json.origen);
		this.destino = new DireccionLogistica(txId, json.destino);

		this.observaciones = json.observaciones || null;
		this.servicio = json.servicio || null;

		this.#extraerLineas(json.lineas);
		this.#sanearIncidenciasSap(json.incidencias);

		L.xt(this.txId, ['Metadatos', this.metadatos]);

		this.#establecerFlags();
	}

	#sanearIncidenciasSap(incidenciasJson) {
		L.xt(this.txId, ['Saneando incidencias de SAP', incidenciasJson]);
		this.incidencias = !(incidenciasJson?.length) ? null : incidenciasJson.filter(inc => {
			if (inc.descripcion) return true;
			L.xw(this.txId, 'Se descarta la incidencia devuelta por SAP por no tener descripción', inc);
			return false;
		}).map(inc => {
			return {
				codigo: inc.codigo || K.INCIDENCIA_FEDICOM.ERR_PED,
				descripcion: inc.descripcion
			}
		});

		L.xt(this.txId, ['Incidencias saneadas', this.incidencias]);
	}

	#extraerLineas(lineasJson) {
		// Extracción de información de las lineas
		if (!lineasJson) {
			this.lineas = [];
			return;
		}

		this.lineas = lineasJson.length === 0 ? [] : lineasJson.map((linea, index) => {
			let lineaSap = new LineaLogisticaSap(linea, this.txId, index);

			let totales = this.metadatos.totales;

			totales.lineas++;
			if (lineaSap.cantidad) totales.cantidad += lineaSap.cantidad;

			if (lineaSap.incidencias) {
				totales.lineasIncidencias++;
				totales.cantidadIncidencias += lineaSap.cantidad;
			}

			return lineaSap;
		});
	}

	#establecerFlags() {

		let txId = this.txId;
		let totales = this.metadatos.totales;

		iFlags.set(txId, C.flags.TOTALES, totales);

		// Es falta total ?
		if (totales.cantidad === totales.cantidadFalta) iFlags.set(txId, C.flags.FALTATOTAL)

		// Grabamos el tipo
		iFlags.set(txId, C.flags.TIPO, this.tipoLogistica);

		// Grabamos el PT
		if (this.metadatos.puntoEntrega)
			iFlags.set(txId, C.flags.PUNTO_ENTREGA, this.metadatos.puntoEntrega);

	}


	getEstadoTransmision() {
		// Solo si tiene numeroLogistica la transmisión está OK
		if (this.metadatos.numeroLogistica) {
			return K.TX_STATUS.OK;
		} else {
			return K.TX_STATUS.LOGISTICA.SIN_NUMERO_LOGISTICA;
		}
	}



	generarJSON() {
		let json = {};

		if (this.numeroLogistica) json.numeroLogistica = this.numeroLogistica;
		if (this.codigoCliente) json.codigoCliente = this.codigoCliente;
		if (this.numeroLogisticaOrigen) json.numeroLogisticaOrigen = this.numeroLogisticaOrigen;
		if (this.tipoLogistica) json.tipoLogistica = this.tipoLogistica;
		if (this.fechaLogistica) json.fechaLogistica = this.fechaLogistica;
		if (this.fechaRecogidaSolicitada) json.fechaRecogidaSolicitada = this.fechaRecogidaSolicitada;
		if (this.origen) json.origen = this.origen.generarJSON();
		if (this.destino) json.destino = this.destino.generarJSON();

		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.servicio) json.servicio = this.servicio;
		json.lineas = this.lineas.map(linea => linea.generarJSON ? linea.generarJSON() : linea)
		if (this.incidencias) json.incidencias = this.incidencias;
		
		return json;
	}


}




module.exports = LogisticaSap;
