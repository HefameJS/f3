'use strict';
////const C = global.config;
//const L = global.logger;
//const K = global.constants;


/**
 * Esta clase representa un albarán simplificado.
 * Se utiliza en la respuesta de la búsqueda de albaranes.
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