'use strict';
//const C = global.config;
//const K = global.constants;

class ImpuestoAlbaran {

	constructor(posicion) {
		this.tipo = posicion.imp_tipo ? posicion.imp_tipo.replace(/\s+/g, '') : 'DESCONOCIDO';
		this.porcentaje = posicion.imp_porcent;
		this.base = posicion.imp_base * posicion.und_serv;
		this.importe = Math.round(this.base * (this.porcentaje / 100) * 100) / 100;
		this.porcentajeRecargo = posicion.imp_porcent_rec;
		this.importeRecargo = Math.round(this.base * (this.porcentajeRecargo / 100) * 100) / 100;
	}

	sumar(impuesto) {
		this.base = Math.round((this.base + impuesto.base) * 100) / 100;
		this.importe = Math.round(this.base * (this.porcentaje / 100) * 100) / 100;
		this.importeRecargo = Math.round(this.base * (this.porcentajeRecargo / 100) * 100) / 100;
	}

}


module.exports = ImpuestoAlbaran;