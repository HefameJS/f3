'use strict';
const C = global.config;
//const K = global.constants;


class LineaDevolucionSap {

	#transmision;
	#log;

	#metadatos = {
		numeroPosicion: null,
		estupefaciente: false
	}
	
	constructor(transmision, json, numeroPosicion) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;

		this.#log.info(`Posición ${numeroPosicion}: Analizando linea de devolución`);

		this.#metadatos.numeroPosicion = numeroPosicion;

		// Copiamos las propiedades de la POSICION que son relevantes		
		this.orden = json.orden;
		this.numeroAlbaran = json.numeroalbaran || null;
		this.fechaAlbaran = json.fechaalbaran || null;
		this.codigoArticulo = json.codigoarticulo || null;
		this.cantidad = parseInt(json.cantidad);
		this.codigoMotivo = json.codigomotivo || null;
		this.descripcionMotivo = C.devoluciones.motivos[this.codigoMotivo] || null;
		this.lote = json.lote || null;
		this.fechaCaducidad = json.fechacaducidad || null;
		this.valeEstupefaciente = json.valeestupefaciente || null;
		this.incidencias = json.incidencias.length === 0 ? null : json.incidencias;
		this.observaciones = json.observaciones || null;
		this.numeroDevolucionSap = json.sap_num_devo_fedi || null;

		if (this.valeEstupefaciente) {
			this.#metadatos.estupefaciente = true;
		}

	}

	esEstupefaciente() {
		return this.#metadatos.estupefaciente;
	}

	tieneIncidencias() {
		return this.incidencias?.length > 0;
	}

	generarJSON(tipoReceptor = 'respuestaCliente') {
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