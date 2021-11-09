'use strict';
const C = global.C;
const ErrorFedicom = require('modelos/ErrorFedicom');
const Modelo = require('modelos/transmision/Modelo');


class LineaPedidoSap extends Modelo {

	metadatos = {
		numeroPosicion: null,
		tipificadoFalta: null,
		estupefaciente: false,
		almacenDeRebote: null
	}

	orden;
	codigoArticulo;
	descripcionArticulo;
	codigoArticuloSustituyente;
	codigoUbicacion;
	cantidad;
	cantidadFalta;
	cantidadBonificacion;
	cantidadBonificacionFalta;
	precio;
	descuentoPorcentaje;
	descuentoImporte;
	cargoPorcentaje;
	cargoImporte;
	valeEstupefaciente;
	codigoAlmacenServicio;
	condicion;
	servicioDemorado;
	estadoServicio;
	fechaLimiteServicio;
	servicioAplazado;
	observaciones;
	incidencias;

	constructor(transmision, json, numeroPosicion) {

		super(transmision);

		this.metadatos.numeroPosicion = numeroPosicion;
		this.log.info(`Analizando linea de pedido SAP en posición ${numeroPosicion}`);

		// Copiamos las propiedades definidas en el protocolo		
		if (json.orden >= 0) this.orden = parseInt(json.orden);
		if (json.codigoarticulo) this.codigoArticulo = json.codigoarticulo;
		if (json.descripcionarticulo) this.descripcionArticulo = json.descripcionarticulo;
		if (json.codigoarticulosustituyente) this.codigoArticuloSustituyente = json.codigoarticulosustituyente;
		if (json.codigoubicacion) this.codigoUbicacion = json.codigoubicacion;
		if (json.cantidad >= 0) this.cantidad = parseInt(json.cantidad);
		if (json.cantidadfalta >= 0) this.cantidadFalta = parseInt(json.cantidadfalta);
		if (json.cantidadbonificacion >= 0) this.cantidadBonificacion = parseInt(json.cantidadbonificacion);
		if (json.cantidadbonificacionfalta >= 0) this.cantidadBonificacionFalta = parseInt(json.cantidadbonificacionfalta);
		if (json.precio >= 0) this.precio = parseFloat(json.precio);
		if (json.descuentoporcentaje >= 0) this.descuentoPorcentaje = parseFloat(json.descuentoporcentaje);
		if (json.descuentoimporte >= 0) this.descuentoImporte = parseFloat(json.descuentoimporte);
		if (json.cargoporcentaje >= 0) this.cargoPorcentaje = parseFloat(json.cargoporcentaje);
		if (json.cargoimporte >= 0) this.cargoImporte = parseFloat(json.cargoimporte);
		if (json.valeestupefaciente) this.valeEstupefaciente = json.valeestupefaciente;
		if (json.codigoalmacenservicio) this.codigoAlmacenServicio = json.codigoalmacenservicio;
		if (json.condicion) this.condicion = json.condicion;
		if (json.serviciodemorado) this.servicioDemorado = json.serviciodemorado;
		// if (json.estadoservicio) this.estadoServicio = json.estadoservicio;
		if (json.fechalimiteservicio) this.fechaLimiteServicio = json.fechalimiteservicio;
		if (json.servicioaplazado) this.servicioAplazado = json.servicioaplazado;
		if (json.observaciones) this.observaciones = json.observaciones;
		if (Array.isArray(json.incidencias) && json.incidencias.length) this.incidencias = json.incidencias;

		// Tipificado del motivo de la falta
		if (this.incidencias) {
			this.incidencias.forEach(incidencia => {
				if (incidencia.descripcion) {
					this.metadatos.tipificadoFalta = C.pedidos.tipificadoFaltas[incidencia.descripcion];
				}
			})
		}

		this.#calculaEstadoServicio();

		// Indica si la linea tiene algo que ver con los estupes
		this.metadatos.estupefaciente = (this.valeEstupefaciente || this.metadatos.tipificadoFalta === "estupe");

	}

	#calculaEstadoServicio() {
		if (this.servicioDemorado) {
			this.estadoServicio = (this.cantidadFalta === this.cantidad ? 'SR' : 'SC');
		} else {
			this.estadoServicio = null;
		}
	}

	gestionarReboteFaltas(almacenCabecera) {

		// Si el almacén de cabecera y posición son distintos Y la línea no es falta total
		if (almacenCabecera && this.codigoAlmacenServicio && almacenCabecera !== this.codigoAlmacenServicio && this.cantidad !== this.cantidadFalta) {

			this.metadatos.almacenDeRebote = this.codigoAlmacenServicio;
			
			this.log.info(`Posición ${this.metadatos.numeroPosicion}: Detectado rebote de faltas para la línea ${almacenCabecera} != ${this.codigoAlmacenServicio}`)

			if (this.servicioDemorado) {

				let cantidadRebotada = this.cantidad - (this.cantidadFalta ?? 0);
				this.cantidadFalta = this.cantidad;
				this.estadoServicio = 'SC';
				this.servicioAplazado = {
					fechaServicio: Date.siguienteDiaHabil(),
					cantidad: cantidadRebotada
				}

			} else {

				this.log.info(`Posición ${this.metadatos.numeroPosicion}: Hay rebote pero no se admite servicio demorado, se añaden incidencias`);

				let advertenciaRebote = new ErrorFedicom();
				if (this.cantidadFalta === 0) {
					advertenciaRebote.insertar('LIN-PED-WARN-019', 'Entrega total demorada');
				} else {
					advertenciaRebote.insertar('LIN-PED-WARN-020', 'Entrega parcial demorada');
				}

				if (this.incidencias) this.incidencias.concat(advertenciaRebote.getErrores());
				else this.incidencias = advertenciaRebote.getErrores();

				this.observaciones = `El artículo se sirve por '${this.codigoAlmacenServicio}'`;
			}
		}
	}

	generarJSON() {

		let json = {};
		if (this.orden >= 0) json.orden = this.orden;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.descripcionArticulo) json.descripcionArticulo = this.descripcionArticulo;
		if (this.codigoArticuloSustituyente) json.codigoArticuloSustituyente = this.codigoArticuloSustituyente;
		if (this.codigoUbicacion) json.codigoUbicacion = this.codigoUbicacion;
		if (this.cantidad >= 0) json.cantidad = this.cantidad;
		if (this.cantidadFalta) json.cantidadFalta = this.cantidadFalta;
		if (this.cantidadBonificacion) json.cantidadBonificacion = this.cantidadBonificacion;
		if (this.cantidadBonificacionFalta) json.cantidadBonificacionFalta = this.cantidadBonificacionFalta;
		if (this.precio) json.precio = this.precio;
		if (this.descuentoPorcentaje) json.descuentoPorcentaje = this.descuentoPorcentaje;
		if (this.descuentoImporte) json.descuentoImporte = this.descuentoImporte;
		if (this.cargoPorcentaje) json.cargoPorcentaje = this.cargoPorcentaje;
		if (this.cargoImporte) json.cargoImporte = this.cargoImporte;
		if (this.valeEstupefaciente) json.valeEstupefaciente = this.valeEstupefaciente;
		if (this.codigoAlmacenServicio) json.codigoAlmacenServicio = this.codigoAlmacenServicio;
		if (this.condicion) json.condicion = this.condicion;
		if (this.servicioDemorado) json.servicioDemorado = this.servicioDemorado;
		if (this.estadoServicio) json.estadoServicio = this.estadoServicio;
		if (this.fechaLimiteServicio) json.fechaLimiteServicio = this.fechaLimiteServicio;
		if (this.servicioAplazado) json.servicioAplazado = this.servicioAplazado;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.incidencias) json.incidencias = this.incidencias;

		// TEMPORAL PRUEBAS UNYCOP
		if (this.codigoArticulo === '8470001012975') {
			json.incidencias = [
				{
					codigo: "LIN-PED-WARN-001",
					descripcion: "NO HAY EXISTENCIAS"
				},
				{
					codigo: "LIN-PED-WARN-010",
					descripcion: "BAJA HEFAME"
				}
			]
		}
		// TEMPORAL PRUEBAS UNYCOP

		return json;
	}

	tieneIncidencias() {
		return this.incidencias?.length > 0;
	}

}










module.exports = LineaPedidoSap;