'use strict';
const C = global.C;
const Modelo = require("modelos/transmision/Modelo");


class LineaDevolucionSap extends Modelo {

	metadatos = {
		numeroPosicion: null,
		estupefaciente: false,
		numeroDevolucionSap: null
	}

	orden;
	numeroAlbaran;
	fechaAlbaran;
	codigoArticulo;
	cantidad;
	codigoMotivo;
	descripcionMotivo;
	lote;
	fechaCaducidad;
	valeEstupefaciente;
	incidencias;
	observaciones;
	

	constructor(transmision, json, numeroPosicion) {

		super(transmision);

		this.log.info(`Posición ${numeroPosicion}: Analizando linea de devolución SAP`);

		this.metadatos.numeroPosicion = numeroPosicion;

		// Copiamos las propiedades de la POSICION que son relevantes		
		this.orden = json.orden;
		if (json.numeroalbaran) this.numeroAlbaran = json.numeroalbaran;
		if (json.fechaalbaran) this.fechaAlbaran = json.fechaalbaran;
		if (json.codigoarticulo) this.codigoArticulo = json.codigoarticulo;
		if (json.cantidad >= 0) this.cantidad = parseInt(json.cantidad);
		if (json.codigomotivo) {
			this.codigoMotivo = json.codigomotivo;
			this.descripcionMotivo = C.devoluciones.motivos[this.codigoMotivo];
		}
		if (json.lote) this.lote = json.lote;
		if (json.fechacaducidad) this.fechaCaducidad = json.fechacaducidad;
		
		if (this.valeEstupefaciente) {
			this.valeEstupefaciente = json.valeestupefaciente;
			this.metadatos.estupefaciente = true;
		}
		if (json.observaciones) this.observaciones = json.observaciones;
		if (json.sap_num_devo_fedi) this.metadatos.numeroDevolucionSap = parseInt(json.sap_num_devo_fedi);
		if (Array.isArray(json.incidencias) && json.incidencias.length) {
			this.incidencias = json.incidencias;
		}

	}

	generarJSON() {
		let json = {};
		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.numeroAlbaran) json.numeroAlbaran = this.numeroAlbaran;
		if (this.fechaAlbaran) json.fechaAlbaran = this.fechaAlbaran;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.cantidad || this.cantidad === 0) json.cantidad = this.cantidad;
		if (this.codigoMotivo) json.codigoMotivo = this.codigoMotivo;
		if (this.descripcionMotivo) json.descripcionMotivo = this.descripcionMotivo;
		if (this.lote) json.lote = this.lote;
		if (this.fechaCaducidad) json.fechaCaducidad = this.fechaCaducidad;
		if (this.valeEstupefaciente) json.valeEstupefaciente = this.valeEstupefaciente;
		if (this.incidencias) json.incidencias = this.incidencias;
		if (this.observaciones) json.observaciones = this.observaciones;
		return json;
	}

}

module.exports = LineaDevolucionSap;