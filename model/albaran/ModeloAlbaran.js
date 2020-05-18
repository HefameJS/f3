'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externas
const clone = require('clone');


/**
 * Los datos del albarán llegan de manera distinta de SAP en función de si estos datos se obtuvieron de la llamada para listar albaranes
 * o de la llamada para obtener la información de un único albarán. Esta función unifica ambos modelos para que el objeto de albarán se 
 * construya de la misma manera, independientemente del origen.
 * @param {*} cab 
 */
const _unificacionAtributosSap = (cab) => {
	if (cab.proforma) {

		cab.albaran = cab.proforma;
		cab.fecha_imp = cab.erdat;
		if (cab.factura) cab.numero_factura = cab.factura;
		if (cab.factura && cab.fe_fact) cab.fecha_factura = cab.fe_fact;
		cab.cod_almacen = cab.yy_centro;
		cab.almacen = undefined;
		cab.numero_entrega = cab.order_del;
		cab.operador = cab.bsark;
		cab.ruta = cab.yylzone;

		cab.numero_pedido = cab.vbeln;
		cab.clase = cab.konda;
	}
	return cab;
}


/**
 * Esta clase representa un albarán.
 * Se utiliza para convertir los albaranes tal como vienen de SAP a una estructura en formato Fedicom v3.
 */
class Albaran {
	constructor(cab) {
		//this.original = cab;

		cab = _unificacionAtributosSap(cab);

		this.codigoCliente = cab.kunnr;
		this.numeroAlbaran = cab.albaran;
		this.fechaAlbaran = Date.fromSAPtoFedicomDate(cab.fecha_imp) || undefined;
		if (cab.numero_factura) this.numeroFactura = cab.numero_factura;
		if (cab.numero_factura && this.fecha_factura) this.fechaFactura = Date.fromSAPtoFedicomDate(cab.fecha_factura) || undefined;
		this.codigoAlmacen = cab.cod_almacen;
		this.descripcionAlmacen = cab.almacen;
		this.reparto = cab.numero_entrega;
		this.operador = cab.operador;
		this.ruta = cab.ruta + (cab.denom_ruta ? ' - ' + cab.denom_ruta : '');
		this.observaciones = cab.estado;

		this.pedidos = [
			{
				numeroPedido: cab.numero_pedido,
				tipoPedido: cab.clase + (cab.clase_pedido ? ' - ' + cab.clase_pedido : ''),
				aplazamiento: undefined,
				canal: (cab.vtweg || undefined)
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
		this.base = Math.round((this.base + impuesto.base) * 100) / 100;
		this.importe = Math.round(this.base * (this.porcentaje / 100) * 100) / 100;
		this.importeRecargo = Math.round(this.base * (this.porcentajeRecargo / 100) * 100) / 100;
	}

}


module.exports = Albaran;