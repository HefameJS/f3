'use strict';
//const C = global.config;
//const K = global.constants;

const Modelo = require("modelos/transmision/Modelo");




class LineaLogisticaSap extends Modelo{

	metadatos = {
		numeroPosicion: null
	}

	orden;
	codigoArticulo;
	descripcionArticulo;
	codigoBarras;
	localizador;
	cantidad;
	observaciones;
	incidencias;

	constructor(transmision, json, numeroPosicion) {

		super(transmision);

		this.log.debug(`Posición ${numeroPosicion}: Analizando linea de pedido`)

		// Copiamos las propiedades de la POSICION que son relevantes		
		this.orden = parseInt(json.orden);
		this.codigoArticulo = json.codigoarticulo || null;
		this.descripcionArticulo = json.descripcionarticulo || null;
		this.cantidad = parseInt(json.cantidad);
		this.codigoBarras = json.codbar || null;
		this.localizador = json.localizador || null;
		this.observaciones = json.observaciones || null;

		if (json.incidencias?.length) {
			this.incidencias = json.incidencias
				.filter(inc => {
					if (inc.descripcion) return true;
					this.log.warn(`Posición ${numeroPosicion}:Se descarta la incidencia devuelta por SAP por no tener descripción`, inc);
					return false;
				})
				.map(inc => {
					return {
						codigo: inc.codigo || 'LIN-LOG-ERR-999',
						descripcion: inc.descripcion
					}
				});
		}

	}

	generarJSON() {
		let json = {};
		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.descripcionArticulo) json.descripcionArticulo = this.descripcionArticulo;
		if (this.cantidad || this.cantidad === 0) json.cantidad = this.cantidad;
		if (this.codigoBarras) json.codigoBarras = this.codigoBarras;
		if (this.localizador) json.localizador = this.localizador;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.incidencias) json.incidencias = this.incidencias;
		return json;
	}

}










module.exports = LineaLogisticaSap;