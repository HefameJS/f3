'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externas
const clone = require('clone');


/**
 * Esta clase representa un albarán simplificado.
 * Se utiliza en la respuesta de la búsqueda de albaranes.
 */
class AlbaranCompleto {
	constructor(cab) {
		//this.original = cab;

		this.codigoCliente = cab.kunnr;
		this.numeroAlbaran = cab.albaran;
		this.fechaAlbaran = Date.fromSAPtoFedicomDate(cab.fecha_imp) || undefined;
		if (cab.numero_factura) this.numeroFactura = cab.numero_factura;
		if (cab.numero_factura && this.fecha_factura) this.fechaFactura = Date.fromSAPtoFedicomDate(cab.fecha_factura) || undefined;
		this.codigoAlmacen = cab.cod_almacen;
		this.descripcionAlmacen = cab.almacen;
		this.reparto = cab.numero_entrega;
		this.operador = cab.operador;
		this.ruta = cab.ruta + ' - ' + cab.denom_ruta;
		this.observaciones = cab.estado;

		this.pedidos = [
			{
				numeroPedido: cab.numero_pedido,
				tipoPedido: cab.clase + ' - ' + cab.clase_pedido,
				aplazamiento: undefined,
				canal: undefined
			}
		];


		//  Se hace recuento de impuestos y totales al tratar las lineas
		this.impuestos = [];
		let sumatorioImpuestos = {};
		this.totales = {
			lineas: 0,
			lineasServidas: 0,
			lineasFalta: 0,
			lineasBonificada: 0,
			cantidadPedida: 0,
			cantidadServida: 0,
			cantidadBonificada: 0,
			precioPvp: 0,
			precioNeto: 0,
			precioAlbaran: 0,
			impuestos: this.impuestos
		}



		// Tratamiendo de líneas
		this.lineas = [];
		cab.t_pos.forEach(pos => {
			let linea = new LineaAlbaran(pos)
			if (!linea.codigoArticulo) return;

			this.totales.lineas++;
			if (linea.cantidadServida) this.totales.lineasServidas++;
			if (linea.cantidadPedida > linea.cantidadServida) this.totales.lineasFalta++;
			if (linea.cantidadBonificada) this.totales.lineasBonificada++;
			this.totales.cantidadPedida += linea.cantidadPedida;
			this.totales.cantidadServida += linea.cantidadServida;
			this.totales.cantidadBonificada += linea.cantidadBonificada;
			this.totales.precioPvp += (linea.cantidadServida * linea.precioPvp);
			this.totales.precioNeto += (linea.cantidadServida * linea.precioNeto);
			this.totales.precioAlbaran += (linea.cantidadServida * linea.precioAlbaran);

			if (linea.impuesto) {
				let impuesto = linea.impuesto;
				if (!sumatorioImpuestos[impuesto.porcentaje]) {
					sumatorioImpuestos[impuesto.porcentaje] = clone(impuesto);
				} else {
					sumatorioImpuestos[impuesto.porcentaje].sumar(impuesto);
				}
			}

			this.lineas.push(linea);
		});

		this.totales.precioPvp = Math.round(this.totales.precioPvp * 100) / 100
		this.totales.precioNeto = Math.round(this.totales.precioNeto * 100) / 100
		this.totales.precioAlbaran = Math.round(this.totales.precioAlbaran * 100) / 100

		for (let tipoImpuesto in sumatorioImpuestos) {
			this.impuestos.push(sumatorioImpuestos[tipoImpuesto]);
		}

	}
}


class LineaAlbaran {
	constructor(posicion) {
		this.orden = posicion.posicion;
		this.codigoArticulo = posicion.codigo;
		this.descripcionArticulo = posicion.descripcion;
		if (posicion.t_lotes.length > 0) this.lotes = posicion.t_lotes.map(lote => {
			return {
				lote: lote.lote,
				fechaCaducidad: Date.fromSAPtoFedicomDate(lote.fecad)
			}
		});
		if (posicion.t_box && posicion.t_box.length) this.cubeta = posicion.t_box;
		this.cantidadPedida = posicion.und_ped;
		this.cantidadServida = posicion.und_serv;
		this.cantidadBonificada = posicion.und_bonif;
		this.precioPvp = posicion.precio_pvp;
		this.precioNeto = posicion.precio_neto;
		this.precioAlbaran = posicion.precio_alb;
		if (posicion.imp_porcent > 0) this.impuesto = new Impuesto(posicion);

		if (posicion.des_importe > 0) this.descuento = {
			tipo: posicion.des_tipo,
			descripcion: posicion.des_descrp,
			porcentaje: posicion.des_porcent,
			importe: Math.round((this.precioAlbaran * this.cantidadServida) * posicion.des_porcent) / 100
		}
		if (posicion.carg_importe > 0) this.cargo = {
			tipo: posicion.carg_tipo,
			descripcion: posicion.carg_descrp,
			porcentaje: posicion.carg_porcent,
			importe: Math.round((this.precioAlbaran * this.cantidadServida) * posicion.carg_porcent) / 100
		}

		//this.observaciones = undefined;
		if (posicion.t_incidencias && posicion.t_incidencias.length) this.incidencias = posicion.t_incidencias;
	}
}




class Impuesto {

	constructor(posicion) {
		this.tipo = posicion.imp_tipo ? posicion.imp_tipo.replace(/\s+/g, '') : 'DESCONOCIDO';
		this.porcentaje = posicion.imp_porcent;
		this.base = posicion.imp_base * posicion.und_serv;
		this.importe = Math.round(this.base * (this.porcentaje / 100) * 100) / 100;
		this.porcentajeRecargo = posicion.imp_porcent_rec;
		this.importeRecargo = Math.round(this.base * (this.porcentajeRecargo / 100) * 100) / 100;
	}

	sumar(impuesto) {
		this.base += impuesto.base;
		this.importe = Math.round(this.base * (this.porcentaje / 100) * 100) / 100;
		this.importeRecargo = Math.round(this.base * (this.porcentajeRecargo / 100) * 100) / 100;
	}

}


module.exports = AlbaranCompleto;