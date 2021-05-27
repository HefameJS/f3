'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Helpers
const Maestro = require('global/maestro');


class LineaPedidoSap {
	constructor(json, txId, numeroPosicion) {
		L.xi(txId, ['Analizando linea de pedido en posicion ' + numeroPosicion])

		this.metadatos = {
			numeroPosicion: numeroPosicion,
			tipoFalta: null,
			estupefaciente: false,
			reboteFaltas: false
		}

		// Copiamos las propiedades de la POSICION que son relevantes		
		this.orden = parseInt(json.orden);

		this.codigoArticulo = json.codigoarticulo || null;
		this.descripcionArticulo = json.descripcionarticulo || null;
		this.codigoArticuloSustituyente = json.codigoarticulosustituyente || null;
		this.codigoUbicacion = json.codigoubicacion || null;
		this.cantidad = parseInt(json.cantidad);
		this.cantidadFalta = parseInt(json.cantidadfalta);
		this.cantidadBonificacion = parseInt(json.cantidadbonificacion);
		this.cantidadBonificacionFalta = parseInt(json.cantidadbonificacionfalta);
		this.precio = parseFloat(json.precio);
		this.descuentoPorcentaje = parseFloat(json.descuentoporcentaje);
		this.descuentoImporte = parseFloat(json.descuentoimporte);
		this.cargoPorcentaje = parseFloat(json.cargoporcentaje);
		this.cargoImporte = parseFloat(json.cargoimporte);
		this.valeEstupefaciente = json.valeestupefaciente || null;
		this.codigoAlmacenServicio = json.codigoalmacenservicio || null;
		this.condicion = json.condicion || null;
		this.servicioDemorado = Boolean(json.serviciodemorado);
		this.fechaLimiteServicio = json.fechalimiteservicio || null;
		this.servicioAplazado = json.servicioaplazado || null;
		this.observaciones = json.observaciones || null;
		this.incidencias = json.incidencias.length === 0 ? null : json.incidencias;

		// Tipificado del motivo de la falta
		this.incidencias?.forEach(incidencia => {
			if (incidencia.descripcion) {
				this.metadatos.tipoFalta = C.pedidos.tipificadoFaltas[incidencia.descripcion];
			}
		})

		this.#calculaEstadoServicio();

		// Indica si la linea tiene algo que ver con los estupes
		this.metadatos.estupefaciente = (this.valeEstupefaciente || this.metadatos.tipoFalta === "estupe");

	}

	#calculaEstadoServicio() {
		if (this.servicioDemorado) {
			this.estadoServicio = (this.cantidadFalta === this.cantidad ? 'SR' : 'SC');
		} else {
			this.estadoServicio = null;
		}
	}

	gestionarReboteFaltas(almacenCabecera) {

		if (almacenCabecera && this.codigoAlmacenServicio && almacenCabecera !== this.codigoAlmacenServicio && this.cantidad !== this.cantidadFalta) {

			this.metadatos.reboteFaltas = this.codigoAlmacenServicio;
			L.xi(this.txId, ['Detectado rebote de faltas para la línea', almacenCabecera, this.codigoAlmacenServicio])

			if (this.servicioDemorado) {

				let cantidadRebotada = this.cantidad - (this.cantidadFalta ?? 0);

				this.cantidadFalta = this.cantidad;
				this.estadoServicio = 'SC';

				this.servicioAplazado = {
					fechaServicio: Date.siguienteDiaHabil(),
					cantidad: cantidadRebotada
				}

			} else {

				L.xw(this.txId, ['Hay rebote pero no se admite servicio demorado, se añaden incidencias']);

				if (this.cantidadFalta === 0) {
					this.incidencias = [{
						codigo: 'LIN-PED-WARN-019',
						descripcion: 'Entrega total demorada'
					}];
				} else {
					this.incidencias = [{
						codigo: 'LIN-PED-WARN-020',
						descripcion: 'Entrega parcial demorada'
					}];
				}

				this.observaciones = 'El artículo se sirve por ' + Maestro.almacenes.getNombreById(this.codigoAlmacenServicio);
			}


		}

	}

	generarJSON() {
		let json = {};
		if (this.orden || this.orden === 0) json.orden = this.orden;

		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.descripcionArticulo) json.descripcionArticulo = this.descripcionArticulo;
		if (this.codigoArticuloSustituyente) json.codigoArticuloSustituyente = this.codigoArticuloSustituyente;

		if (this.cantidad || this.cantidad === 0) json.cantidad = this.cantidad;
		if (this.cantidadFalta) json.cantidadFalta = this.cantidadFalta;
		if (this.cantidadBonificacion) json.cantidadBonificacion = this.cantidadBonificacion;
		if (this.cantidadBonificacionFalta) json.cantidadBonificacionFalta = this.cantidadBonificacionFalta;


		if (this.valeEstupefaciente) json.valeEstupefaciente = this.valeEstupefaciente;
		if (this.codigoAlmacenServicio) json.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.codigoUbicacion) json.codigoUbicacion = this.codigoUbicacion;

		if (this.condicion) json.condicion = this.condicion;
		if (this.precio) json.precio = this.precio;
		if (this.descuentoPorcentaje) json.descuentoPorcentaje = this.descuentoPorcentaje;
		if (this.descuentoImporte) json.descuentoImporte = this.descuentoImporte;
		if (this.cargoPorcentaje) json.cargoPorcentaje = this.cargoPorcentaje;
		if (this.cargoImporte) json.cargoImporte = this.cargoImporte;


		if (this.fechaLimiteServicio) json.fechaLimiteServicio = this.fechaLimiteServicio;
		if (this.servicioDemorado) json.servicioDemorado = this.servicioDemorado;
		if (this.estadoServicio) json.estadoServicio = this.estadoServicio;
		if (this.servicioAplazado) json.servicioAplazado = this.servicioAplazado;
		this.fechaLimiteServicio = json.fechalimiteservicio || null;

		if (this.incidencias) json.incidencias = this.incidencias;
		if (this.observaciones) json.observaciones = this.observaciones;
		return json;
	}

}










module.exports = LineaPedidoSap;