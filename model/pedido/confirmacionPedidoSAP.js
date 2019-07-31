'use strict';
const BASE = global.BASE;


const FedicomError = require(BASE + 'model/fedicomError');
const LineaConfirmacionPedido = require(BASE + 'model/pedido/ConfirmacionLineaPedidoSAP');
const FieldChecker = require(BASE + 'util/fieldChecker');
const crypto = require('crypto');



const L = global.logger;


function parseLines( json, txId ) {
	var lineas = [];

	function rellena ( lineas ) {

		json.lineas.forEach( function (linea) {
			var lineaPedido = new LineaConfirmacionPedido(linea, txId);
			lineas.push(lineaPedido);
		});

	}
	return rellena( lineas );
}


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
		this.sap_crc = this.crc
		var lineas = parseLines( json, req.txId );
		this.lineas = lineas;

		// RE-GENERACION DE CRC
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.codigoCliente + this.numeroPedidoOrigen).digest('hex').substring(0,24).toUpperCase();
		L.xd(req.txId, ['Se recalcula el CRC del pedido confirmado', this.crc], 'txCRC')
	}



}

module.exports = ConfirmacionPedidoSAP;
