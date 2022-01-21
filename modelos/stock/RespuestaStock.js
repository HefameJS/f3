'use strict';


class RespuestaStock {

	cantidadConsumida;
	cantidadRemanente;
	cantidadTotal;
	codigoArticulo;
	descripcionArticulo;
	porcentajeDescuento;

	constructor(jsonSap) {
		this.cantidadConsumida = jsonSap.cantconscliente;
		this.cantidadRemanente = jsonSap.cantremanente;
		this.cantidadTotal = jsonSap.canttotal;
		this.codigoArticulo = jsonSap.codarticulo;
		this.descripcionArticulo = jsonSap.nombrearticulo;
		this.porcentajeDescuento = jsonSap.pdescuento;
	}

}

module.exports = RespuestaStock;