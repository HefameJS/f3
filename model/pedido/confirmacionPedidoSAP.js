'use strict';
const BASE = global.BASE;
const L = global.logger;
const C = global.config;
const K = global.constants;


const FedicomError = require(BASE + 'model/fedicomError');
const Pedido = require(BASE + 'model/pedido/pedido');
const ConfirmacionLineaPedidoSAP = require(BASE + 'model/pedido/confirmacionLineaPedidoSAP');

const FieldChecker = require(BASE + 'util/fieldChecker');
const CRC = require(BASE + 'model/CRC');





class ConfirmacionPedidoSAP {

	constructor(req) {

		var json = req.body;

		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();
		FieldChecker.checkExists(json.numeropedido, fedicomError, 'SAP-ERR-001', 'No se indica el campo "numeropedido"');
		FieldChecker.checkExists(json.codigocliente, fedicomError, 'SAP-ERR-002', 'No se indica el campo "codigocliente"');
		FieldChecker.checkExists(json.numeropedidoorigen, fedicomError, 'SAP-ERR-003', 'No se indica el campo "numeropedidoorigen"')
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, fedicomError, 'SAP-ERR-004', 'No se indica el campo "lineas"');
		FieldChecker.checkExists(json.crc, fedicomError, 'SAP-ERR-005', 'No se indica el campo "crc"');

		if (fedicomError.hasError()) {
			L.xe(req.txId, ['La confirmación del pedido contiene errores. Se aborta el procesamiento del mismo', fedicomError]);
			throw fedicomError;
		}
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		var lineas = parseLines(json, req.txId);
		this.lineas = lineas;

		// El CRC de SAP es el de 8 dígitos, regeneramos el de 24 dígitos
		this.sap_crc = this.crc
		this.crc = CRC.crear(this.codigocliente, this.numeropedidoorigen);
		L.xd(req.txId, ['Se recalcula el CRC del pedido confirmado', this.crc], 'txCRC');

	}

	obtenerEstado() {
		var numerosPedidoSAP = Pedido.extraerPedidosAsociados(this.sap_pedidosasociados);
		var estadoTransmision = numerosPedidoSAP ? K.TX_STATUS.OK : K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		return [estadoTransmision, numerosPedidoSAP];
	}

	static obtenerEstadoDeConfirmacionSap(sapBody) {
		var numerosPedidoSAP = Pedido.extraerPedidosAsociados(sapBody.sap_pedidosasociados);
		var estadoTransmision = numerosPedidoSAP ? K.TX_STATUS.OK : K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		return [estadoTransmision, numerosPedidoSAP];
	}

}


const parseLines = (json, txId) => {
	var lineas = [];
	function rellena(lineas) {
		json.lineas.forEach(function (linea) {
			var lineaPedido = new ConfirmacionLineaPedidoSAP(linea, txId);
			lineas.push(lineaPedido);
		});
		return lineas;
	}
	return rellena(lineas);
}

module.exports = ConfirmacionPedidoSAP;
