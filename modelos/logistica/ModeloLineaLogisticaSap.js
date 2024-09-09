'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;


class LineaLogisticaSap {
	constructor(json, txId, numeroPosicion) {
		L.xi(txId, ['Analizando linea de pedido en posición ' + numeroPosicion])

		this.metadatos = {
		}

		// Copiamos las propiedades de la POSICION que son relevantes		
		this.orden = parseInt(json.orden);

		this.codigoArticulo = json.codigoarticulo || null;
		this.descripcionArticulo = json.descripcionarticulo || null;
		this.codigoBarras = json.codbar || null;
		this.localizador = json.localizador || null;
		this.codigoBarrasExterno = json.codigobarrasexterno || null;

		this.cantidad = parseInt(json.cantidad);
		this.observaciones = json.observaciones || null;

		this.incidencias = json.incidencias?.length === 0 ? null : json.incidencias;
		
	}

	generarJSON() {
		let json = {};
		if (this.orden || this.orden === 0) json.orden = this.orden;

		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.descripcionArticulo) json.descripcionArticulo = this.descripcionArticulo;
		if (this.cantidad || this.cantidad === 0) json.cantidad = this.cantidad;
		if (this.codigoBarras) json.codigoBarras = this.codigoBarras;
		if (this.localizador) json.localizador = this.localizador;
		if (this.codigoBarrasExterno) json.codigoBarrasExterno = this.codigoBarrasExterno;

		if (this.incidencias) json.incidencias = this.incidencias;
		if (this.observaciones) json.observaciones = this.observaciones;
		return json;
	}

}










module.exports = LineaLogisticaSap;