'use strict';
const BASE = global.BASE;
const L = global.logger;
const C = global.config;
const K = global.constants;

// Modelos
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');
const Pedido = require('./ModeloPedido');
const ConfirmacionLineaPedidoSAP = require('./ModeloConfirmacionLineaPedidoSAP');
const CRC = require(BASE + 'model/CRC');

// Helpers
const FieldChecker = require(BASE + 'util/fieldChecker');



class ConfirmacionPedidoSAP {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		// SANEADO OBLIGATORIO
		let errorFedicom = new ErrorFedicom();
		FieldChecker.checkExists(json.numeropedido, errorFedicom, 'SAP-ERR-001', 'No se indica el campo "numeropedido"');
		FieldChecker.checkExists(json.codigocliente, errorFedicom, 'SAP-ERR-002', 'No se indica el campo "codigocliente"');
		FieldChecker.checkExists(json.numeropedidoorigen, errorFedicom, 'SAP-ERR-003', 'No se indica el campo "numeropedidoorigen"')
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, errorFedicom, 'SAP-ERR-004', 'No se indica el campo "lineas"');
		FieldChecker.checkExists(json.crc, errorFedicom, 'SAP-ERR-005', 'No se indica el campo "crc"');

		if (errorFedicom.hasError()) {
			L.xe(txId, ['La confirmación del pedido contiene errores. Se aborta el procesamiento del mismo', errorFedicom]);
			throw errorFedicom;
		}
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		let lineas = _analizarPosiciones(txId, json);
		this.lineas = lineas;

		// El CRC de SAP es el de 8 dígitos, regeneramos el de 24 dígitos
		this.sap_crc = this.crc
		this.crc = CRC.crear(this.codigocliente, this.numeropedidoorigen);
		L.xd(txId, ['Se recalcula el CRC del pedido confirmado', this.crc], 'txCRC');

	}

	obtenerEstado() {
		let numerosPedidoSAP = Pedido.extraerPedidosAsociados(this.sap_pedidosasociados);
		let estadoTransmision = numerosPedidoSAP ? K.TX_STATUS.OK : K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		return [estadoTransmision, numerosPedidoSAP];
	}

	static obtenerEstadoDeConfirmacionSap(sapBody) {
		let numerosPedidoSAP = Pedido.extraerPedidosAsociados(sapBody.sap_pedidosasociados);
		let estadoTransmision = numerosPedidoSAP ? K.TX_STATUS.OK : K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		return [estadoTransmision, numerosPedidoSAP];
	}

}


const _analizarPosiciones = (txId, json) => {
	let lineas = [];

	json.lineas.forEach((linea) => {
		let lineaPedido = new ConfirmacionLineaPedidoSAP(txId, linea);
		lineas.push(lineaPedido);
	});
	return lineas;

}

module.exports = ConfirmacionPedidoSAP;
