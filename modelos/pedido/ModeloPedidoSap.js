'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iflags/iFlags')

// Modelos
const LineaPedidoSap = require('./ModeloLineaPedidoSap');
const Maestro = require('global/maestro');


class PedidoSap {

	constructor(json, pedidoCliente, txId) {

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
			reboteFaltas: false,
			almacenesDeRebote: [],
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


		this.numeroPedido = pedidoCliente.crc || null; // Este CRC lo recibe del PedidoCliente directamente
		this.codigoCliente = json.codigocliente || null;
		this.notificaciones = json.notificaciones?.length > 0 ? json.notificaciones : null;
		this.direccionEnvio = json.direccionenvio || null;
		this.codigoAlmacenServicio = json.codigoalmacenservicio || null;
		this.numeroPedidoOrigen = json.numeropedidoorigen || null;
		this.tipoPedido = json.tipopedido || null;
		this.fechaPedido = Date.toFedicomDateTime();
		this.fechaServicio = json.fechaservicio || null;
		this.aplazamiento = json.aplazamiento || null;
		this.empresaFacturadora = json.empresafacturadora || null;
		this.observaciones = json.observaciones ? [json.observaciones] : [];
		this.alertas = (Array.isArray(json.alertas) && json.alertas.length) ? json.alertas : [];
		this.nombreConsumidorFinal = pedidoCliente.nombreConsumidorFinal || null;
		this.#extraerLineas(json.lineas);
		this.#sanearIncidenciasSap(json.incidencias);
		

		L.xt(this.txId, ['Metadatos', this.metadatos]);

		if (this.metadatos.almacenesDeRebote.length) {
			let nombresAlmacenes = this.metadatos.almacenesDeRebote.map(codigo => Maestro.almacenes.getNombreById(codigo))
			let listaAlmacenes;
			if (nombresAlmacenes.length === 1) {
				listaAlmacenes = nombresAlmacenes[0];
			} else {
				let ultimoAlmacen = nombresAlmacenes.pop();
				listaAlmacenes = nombresAlmacenes.join(', ');
				listaAlmacenes += ` y ${ultimoAlmacen}`
			}
			this.observaciones.push(`Algunos artículos se sirven por ${listaAlmacenes}`);
		}



		this.#establecerFlags();
	}

	#sanearIncidenciasSap(incidenciasJson) {
		L.xt(this.txId, ['Saneando incidencias de SAP', incidenciasJson]);
		this.incidencias = incidenciasJson?.length === 0 ? null : incidenciasJson.filter(inc => {
			/**
			 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Pedido duplicado"}
			 * y activa el flag C.flags.DUPLICADO_SAP si la encuentra
			 */
			L.xt(this.txId, ['INCIDENCIA', inc]);
			if (!inc.codigo && inc.descripcion === 'Pedido duplicado') {
				L.xw(this.txId, ['SAP ha indicado que el pedido es duplicado']);
				this.metadatos.pedidoDuplicadoSap = true;
				return false;
			}
			return Boolean(inc.descripcion);
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
			let lineaSap = new LineaPedidoSap(linea, this.txId, index);
			lineaSap.gestionarReboteFaltas(this.codigoAlmacenServicio);

			let totales = this.metadatos.totales;

			totales.lineas++;
			if (lineaSap.incidencias) totales.lineasIncidencias++;
			if (lineaSap.servicioDemorado) totales.lineasDemorado++;
			if (lineaSap.cantidad) totales.cantidad += lineaSap.cantidad;
			if (lineaSap.cantidadBonificacion) totales.cantidadBonificacion += lineaSap.cantidadBonificacion;
			if (lineaSap.cantidadFalta) totales.cantidadFalta += lineaSap.cantidadFalta;
			if (lineaSap.cantidadBonificacionFalta) totales.cantidadBonificacionFalta += lineaSap.cantidadBonificacionFalta;
			if (lineaSap.metadatos.estupefaciente) {
				totales.lineasEstupe++;
				totales.cantidadEstupe += lineaSap.cantidad;
			}

			if (lineaSap.metadatos.reboteFaltas) {
				this.metadatos.reboteFaltas = true;
				this.metadatos.almacenesDeRebote.push(lineaSap.metadatos.reboteFaltas)
				let nombreAlmacenServicio = Maestro.almacenes.getNombreById(lineaSap.metadatos.reboteFaltas);
				this.alertas.push(`El artículo ${lineaSap.codigoArticulo} (${lineaSap.descripcionArticulo}) se sirve por ${nombreAlmacenServicio}`);
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

		// Tiene lineas demoradas ?
		if (totales.lineasDemorado) iFlags.set(txId, C.flags.DEMORADO)

		// Tiene lineas bonificadas ?
		if (totales.cantidadBonificacion) iFlags.set(txId, C.flags.BONIFICADO)

		// Tiene lineas con estupefaciente ?
		if (totales.lineasEstupe) iFlags.set(txId, C.flags.ESTUPEFACIENTE)


		// El Flag tipoPedido contiene el tipo del pedido convertido a número para permitir búsquedas por tipo de pedido rápidas y fiables. (Donde los tipos de pedido "1", "001", "000001", "001   " son el mismo valor)
		// Si tipoPedido es una clave de transmisión típica de fedicom (un número de 0 a 999999, eliminando espacios a izquierda y derecha) se guarda el valor numérico. 
		// Si no se indica nada, por defecto se usa un 0. Si el valor no es numérico (p.e. se indica grupo de precios SAP como "KF"), se guarda tal cual.
		if (this.tipoPedido) {
			let tipoInt = parseInt(this.tipoPedido);
			if (tipoInt >= 0 && tipoInt <= 999999) {
				iFlags.set(txId, C.flags.TIPO, tipoInt);
			}
		} else {
			iFlags.set(txId, C.flags.TIPO, 0);
		}


		if (this.metadatos.pedidoDuplicadoSap)
			iFlags.set(txId, C.flags.DUPLICADO_SAP);

		if (this.metadatos.puntoEntrega)
			iFlags.set(txId, C.flags.PUNTO_ENTREGA, this.metadatos.puntoEntrega);

		if (this.metadatos.reboteFaltas)
			iFlags.set(txId, C.flags.REBOTE_FALTAS);

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
			if (this.metadatos.pedidosAsociadosSap) {
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
		if (this.observaciones.length) json.observaciones = this.observaciones.join(' - ');
		json.lineas = this.lineas.map(linea => linea.generarJSON ? linea.generarJSON() : linea)
		if (this.incidencias) json.incidencias = this.incidencias;
		if (this.alertas.length) json.alertas = this.alertas;
		if (this.nombreConsumidorFinal) json.nombreConsumidorFinal = this.nombreConsumidorFinal;

		if (this.metadatos.pedidoProcesado) {
			json.numerosPedidoSap = this.metadatos.pedidosAsociadosSap.map(p => parseInt(p));
			if (this.numeroPedido && this.numeroPedidoOrigen) {
				json.numeroRefenciaSap = this.numeroPedidoOrigen.padEnd(12, ' ').substring(0, 12) + this.numeroPedido.substring(0, 8);
			}
		}

		return json;
	}


}




module.exports = PedidoSap;
