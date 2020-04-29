'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


/**
 * ****** DEPRECATED *******
 * Esta clase representa un albarán simplificado.
 * En versiones anteriores del concentrador se utilizaba en la respuesta de la búsqueda de albaranes.
 * Pero desde el 29/04/2020 se pasó a utilizar la clase AlbaranCompleto tambien para esta búsqueda.
 * Esta clase la dejo por si en el futuro fuera útil ver el mapeo del servicio.
 */


class AlbaranSimple {
	constructor(cab) {

		this.codigoCliente = cab.kunnr;
		this.numeroAlbaran = cab.proforma;
		this.fechaAlbaran = Date.fromSAPtoFedicomDate(cab.erdat) || undefined;
		if (cab.factura) this.numeroFactura = cab.factura;
		if (cab.factura) this.fechaFactura = Date.fromSAPtoFedicomDate(cab.fe_fact) || undefined;
		this.codigoAlmacen = cab.yy_centro;
		this.descripcionAlmacen = undefined;
		this.reparto = cab.order_del;
		this.operador = cab.bsark;
		this.ruta = cab.yylzone;
		this.observaciones = cab.estado;
		this.pedidos = [
			{
				numeroPedido: cab.vbeln,
				tipoPedido: cab.konda,
				aplazamiento: undefined,
				canal: cab.vtweg
			}
		];
		this.totales = {
			lineas: cab.lineas,
			lineasServidas: cab.servidas,
			lineasFalta: cab.faltas,
			lineasBonificada: undefined,
			cantidadPedida: undefined,
			cantidadServida: undefined,
			cantidadBonificada: undefined,
			precioPvp: undefined,
			precioPvf: undefined,
			precioPvl: undefined,
			precioNeto: cab.netwr,
			precioAlbaran: cab.importeconsigno
		}


	}
}

module.exports = AlbaranSimple;