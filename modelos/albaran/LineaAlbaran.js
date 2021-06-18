'use strict';
//const C = global.config;
//const K = global.constants;

const ImpuestoAlbaran = require("./ImpuestoAlbaran");


class LineaAlbaran {
	constructor(posicion) {
		this.orden = posicion.posicion;
		this.codigoArticulo = posicion.codigo;
		this.descripcionArticulo = posicion.descripcion;



		this.cantidadPedida = posicion.und_ped;
		this.cantidadServida = posicion.und_serv;
		this.cantidadBonificada = posicion.und_bonif;
		this.precioPvp = posicion.precio_pvp;
		this.precioNeto = posicion.precio_neto;
		this.precioAlbaran = posicion.precio_alb;
		this.precioPvf = this.precioNeto;
		this.precioPvl = 0;
		

		this.importeLineaNeto = Math.round(this.precioNeto * this.cantidadServida * 100) / 100;
		this.importeLineaBruto = Math.round(this.precioAlbaran * this.cantidadServida * 100) / 100;

		// Lotes
		if (posicion.t_lotes?.length > 0) this.lotes = posicion.t_lotes.map(lote => {
			return {
				lote: lote.lote,
				fechaCaducidad: Date.fromSAPtoFedicomDate(lote.fecad)
			}
		});

		// Cubetas
		if (posicion.t_box?.length > 0) this.cubeta = posicion.t_box
			.filter(cubeta => cubeta.cubeta && cubeta.cantidad)
			.map(cubeta => {
				return {
					codigo: cubeta.cubeta,
					unidades: cubeta.cantidad
				}
			});

		if (posicion.imp_porcent > 0) this.impuesto = new ImpuestoAlbaran(posicion);

		if (posicion.des_importe > 0) this.descuento = [{
			tipo: posicion.des_tipo,
			descripcion: posicion.des_descrp,
			porcentaje: posicion.des_porcent,
			importe: Math.round((this.precioAlbaran * this.cantidadServida) * posicion.des_porcent) / 100
		}]
		if (posicion.carg_importe > 0) this.cargo = [{
			tipo: posicion.carg_tipo,
			descripcion: posicion.carg_descrp,
			porcentaje: posicion.carg_porcent,
			importe: Math.round((this.precioAlbaran * this.cantidadServida) * posicion.carg_porcent) / 100
		}]

		//this.observaciones = undefined;
		if (posicion.t_incidencias && posicion.t_incidencias.length) this.incidencias = posicion.t_incidencias;
	}
}






module.exports = LineaAlbaran;