'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


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

		this.impuestos = cab.t_impuestos.map(impuesto => {
			return {
				tipo: impuesto.tipo.replace(/\s/g, ''),
				porcentaje: impuesto.porcentaje,
				base: impuesto.base,
				importe: impuesto.importe,
				porcentajeRecargo: impuesto.porcentajerecargo,
				importeRecargo: impuesto.importerecargo
			}
		});

		this.totales = {
			lineas: 0, //  Se hace recuento al tratar las lineas
			lineasServidas: 0, //  Se hace recuento al tratar las lineas
			lineasFalta: 0, //  Se hace recuento al tratar las lineas
			lineasBonificada: 0, // Se hace recuento al tratar las lineas
			cantidadPedida: 0,
			cantidadServida: 0,
			cantidadBonificada: 0,
			precioPvp: 0,
			//precioPvf: undefined,
			//precioPvl: undefined,
			precioNeto: 0,
			precioAlbaran: 0,
			impuestos: this.impuestos
		}

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
			//this.totales.precioPvl += (linea.cantidadServida * linea.precioPvl);
			//this.totales.precioPvf += (linea.cantidadServida * linea.precioPvf);
			this.totales.precioNeto += (linea.cantidadServida * linea.precioNeto);
			this.totales.precioAlbaran += (linea.cantidadServida * linea.precioAlbaran);
			this.lineas.push(linea);
		});
		this.totales.precioPvp = Math.round(this.totales.precioPvp * 100) / 100
		//this.totales.precioPvl = Math.round(this.totales.precioPvl * 100) / 100
		//this.totales.precioPvf = Math.round(this.totales.precioPvf * 100) / 100
		this.totales.precioNeto = Math.round(this.totales.precioNeto * 100) / 100
		this.totales.precioAlbaran = Math.round(this.totales.precioAlbaran * 100) / 100

	}
}


class LineaAlbaran {
	constructor(pos) {
		this.orden = pos.posicion;
		this.codigoArticulo = pos.codigo;
		this.descripcionArticulo = pos.descripcion;
		//this.pedido = undefined;
		//this.modelo = undefined;
		if (pos.t_lotes.length > 0) this.lotes = pos.t_lotes.map(lote => {
			return {
				lote: lote.lote,
				fechaCaducidad: Date.fromSAPtoFedicomDate(lote.fecad)
			}
		});
		if (pos.t_box && pos.t_box.length) this.cubeta = pos.t_box;
		this.cantidadPedida = pos.und_ped;
		this.cantidadServida = pos.und_serv;
		this.cantidadBonificada = pos.und_bonif;
		this.precioPvp = pos.precio_pvp;
		//this.precioPvf = undefined;
		//this.precioPvl = undefined;
		this.precioNeto = pos.precio_neto;
		this.precioAlbaran = pos.precio_alb;
		if (pos.imp_porcent > 0) this.impuesto = {
			tipo: pos.imp_tipo.replace(/\s/g, ' '),
			porcentaje: pos.imp_porcent,
			base: pos.imp_base,
			importe: pos.imp_importe,
			porcentajeRecargo: pos.imp_porcent_rec,
			importeRecargo: pos.imp_import_rec
		}
		if (pos.des_importe > 0) this.descuento = {
			tipo: pos.des_tipo,
			descripcion: pos.des_descrp,
			porcentaje: pos.des_porcent,
			importe: pos.des_importe
		}
		if (pos.carg_importe > 0) this.cargo = {
			tipo: pos.carg_tipo,
			descripcion: pos.carg_descrp,
			porcentaje: pos.carg_porcent,
			importe: pos.carg_importe
		}

		//this.observaciones = undefined;
		if (pos.t_incidencias && pos.t_incidencias.length) this.incidencias = pos.t_incidencias;
	}
}


module.exports = AlbaranCompleto;