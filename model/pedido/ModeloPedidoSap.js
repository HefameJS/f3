'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iFlags')

// Modelos
const LineaPedidoSap = require('./ModeloLineaPedidoSap');


class PedidoSap {

	constructor(json, crc, txId) {

		this.txId = txId;
		L.xt(txId, ['Instanciando objeto PedidoSap con los datos del cuerpo HTTP', json]);

		this.metadatos = {
			pedidoProcesado: json.sap_pedidoprocesado || false,
			puntoEntrega: json.sap_punto_entrega || null,
			crc: json.crc || null,
			tipoPedidoSap: json.sap_tipopedido || null,
			motivoPedidoSap: json.sap_motivopedido || null,
			clienteSap: json.sap_cliente || null,
			pedidosAsociadosSap: json.sap_pedidosasociados?.filter(numeroPedidoSap => numeroPedidoSap ? true : false),
			pedidoAgrupadoSap: json.numeropedido || null,
			pedidoDuplicadoSap: false,
			totales: {
				lineas: 0,
				lineasIncidencias: 0,
				lineasDemorado: 0,
				lineasEstupe: 0,
				cantidad: 0,
				cantidadBonificacion: 0,
				cantidadFalta: 0,
				cantidadBonificacionFalta: 0,
				cantidadEstupe: 0,
			}
		}


		this.numeroPedido = crc || null; // Este CRC lo recibe del PedidoCliente directamente
		this.fechaPedido = Date.toFedicomDateTime();

		this.codigoCliente = json.codigocliente || null;
		this.numeroPedidoOrigen = json.numeropedidoorigen || null;
		this.tipoPedido = json.tipopedido || null;
		this.codigoAlmacenServicio = json.codigoalmacenservicio || null;
		this.notificaciones = json.notificaciones?.length > 0 ? json.notificaciones : null;
		this.direccionEnvio = json.direccionenvio || null;
		this.fechaServicio = json.fechaservicio || null;
		this.condicion = json.condicion || null;
		this.aplazamiento = json.aplazamiento || null;
		this.cargoCooperativo = json.cargocooperativo || null;
		this.empresaFacturadora = json.empresafacturadora || null;
		this.observaciones = json.observaciones || null;
		this.alertas = json.alertas?.length > 0 ? json.alertas : null;

		this.#sanearIncidenciasSap(json.incidencias);
		this.#extraerLineas(json.lineas);

		this.#establecerFlags();
	}

	#sanearIncidenciasSap(incidenciasJson) {
		this.incidencias = incidenciasJson?.length === 0 ? null : incidenciasJson.filter(inc => {
			/**
			 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Pedido duplicado"}
			 * y activa el flag K.FLAGS.DUPLICADO_SAP si la encuentra
			 */
			if (!inc.codigo && inc.descripcion === 'Pedido duplicado') {
				this.metadatos.pedidoDuplicadoSap = true;
				return false;
			}

			return (inc.descripcion);
		}).map( inc => {
			return {
				codigo: inc.codigo || K.INCIDENCIA_FEDICOM.ERR_PED,
				descripcion: inc.descripcion
			}
		});

	}

	#extraerLineas(lineasJson) {
		// Extracción de información de las lineas
		this.lineas = lineasJson.length === 0 ? [] : lineasJson.map((linea, index) => {
			let lineaSap = new LineaPedidoSap(linea, this.txId, index);

			let totales = this.metadatos.totales;

			totales.lineas++;
			if (lineaSap.incidencias) totales.lineasIncidencias++;
			if (lineaSap.servicioDemorado) totales.lineasDemorado++;
			if (lineaSap.cantidad) totales.cantidad += linea.cantidad;
			if (lineaSap.cantidadBonificacion) totales.cantidadBonificacion += linea.cantidadBonificacion;
			if (lineaSap.cantidadFalta) totales.cantidadFalta += linea.cantidadFalta;
			if (lineaSap.cantidadBonificacionFalta) totales.cantidadBonificacionFalta += linea.cantidadBonificacionFalta;
			if (lineaSap.metadatos.estupefaciente) {
				totales.lineasEstupe++;
				totales.cantidadEstupe += linea.cantidad;
			}

			return lineaSap;
		});
	}

	#establecerFlags() {

		let txId = this.txId;
		let totales = this.metadatos.totales;

		
		iFlags.set(txId, K.FLAGS.TOTALES, totales);

		// Es falta total ?
		if (totales.cantidad === totales.cantidadFalta) iFlags.set(txId, K.FLAGS.FALTATOTAL)

		// Tiene lineas demoradas ?
		if (totales.lineasDemorado) iFlags.set(txId, K.FLAGS.DEMORADO)

		// Tiene lineas bonificadas ?
		if (totales.cantidadBonificacion) iFlags.set(txId, K.FLAGS.BONIFICADO)

		// Tiene lineas con estupefaciente ?
		if (totales.lineasEstupe) iFlags.set(txId, K.FLAGS.ESTUPEFACIENTE)

		
		// El Flag tipoPedido contiene el tipo del pedido convertido a número para permitir búsquedas por tipo de pedido rápidas y fiables. (Donde los tipos de pedido "1", "001", "000001", "001   " son el mismo valor)
		// Si tipoPedido es una clave de transmisión típica de fedicom (un número de 0 a 999999, eliminando espacios a izquierda y derecha) se guarda el valor numérico. 
		// Si no se indica nada, por defecto se usa un 0. Si el valor no es numérico (p.e. se indica grupo de precios SAP como "KF"), se guarda tal cual.
		if (this.tipoPedido) {
			let tipoInt = parseInt(this.tipoPedido);
			if (tipoInt >= 0 && tipoInt <= 999999) {
				iFlags.set(txId, K.FLAGS.TIPO, tipoInt);
			}
		} else {
			iFlags.set(txId, K.FLAGS.TIPO, 0);
		}


		if (this.metadatos.pedidoDuplicadoSap)
			iFlags.set(txId, K.FLAGS.DUPLICADO_SAP);

		if (this.metadatos.puntoEntrega)
			iFlags.set(txId, K.FLAGS.PUNTO_ENTREGA, this.metadatos.puntoEntrega);

	}


	getNumeroPedidoAgrupado() {
		return this.metadatos.pedidoAgrupadoSap;
	}

	getNumerosPedidoSap() {
		return this.metadatos.pedidosAsociadosSap?.length > 0 ? this.metadatos.pedidosAsociadosSap : null;
	}


	getEstadoTransmision() {

		// Si es un pedido inmediato, SAP debe haber devuelto los numeros de pedido asociados si o si
		if (this.metadatos.pedidoProcesado) {
			if (numerosPedidoSAP) {
				return K.TX_STATUS.OK;
			} else {
				return K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
			}
		} else {
			return K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO;
		}
		
	}

	

	generarJSON() {
		let json = {};

		if (this.numeroPedido) json.numeroPedido = this.numeroPedido;
		if (this.fechaPedido) json.fechaPedido = this.fechaPedido;
		if (this.codigoCliente) json.codigoCliente = this.codigoCliente;
		if (this.codigoAlmacenServicio) json.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.notificaciones) json.notificaciones = this.notificaciones;
		if (this.direccionEnvio) json.direccionEnvio = this.direccionEnvio;
		if (this.fechaServicio) json.fechaServicio = this.fechaServicio;
		if (this.condicion) json.condicion = this.condicion;
		if (this.aplazamiento) json.aplazamiento = this.aplazamiento;
		if (this.cargoCooperativo) json.cargoCooperativo = this.cargoCooperativo;
		if (this.empresaFacturadora) json.empresaFacturadora = this.empresaFacturadora;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.alertas) json.alertas = this.alertas;

		json.lineas = this.lineas.map(linea => linea.generarJSON ? linea.generarJSON() : linea)
		if (this.incidencias) json.incidencias = this.incidencias;

		return json;
	}


}




module.exports = PedidoSap;
