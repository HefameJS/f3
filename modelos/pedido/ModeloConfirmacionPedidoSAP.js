'use strict';
const L = global.logger;
//const C = global.config;
const K = global.constants;

// Modelos
// const CRC = require('model/CRC');


class ConfirmacionPedidoSAP {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		// En la confirmación de un pedido desde SAP, ahora mismo importan 3 cosas:
		// - Lista de pedidos asociados en SAP
		// - El CRC de SAP para la búsqueda de la transmisión que está confirmando



		this.pedidosAsociadosSap = json.sap_pedidosasociados?.filter(numeroPedidoSap => numeroPedidoSap ? true : false);
		this.crcSap = parseInt(json.crc, 16);
		this.estadoTransmision = this.pedidosAsociadosSap.length > 0 ? K.TX_STATUS.OK : K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;

		L.xi(txId, ['Confirmacion de SAP recibida con datos', this.pedidosAsociadosSap, this.crcSap, this.estadoTransmision]);
	}

}


module.exports = ConfirmacionPedidoSAP;
