'use strict';
const BASE = global.BASE;


const FedicomError = require(BASE + 'model/fedicomError');
const LineaPedido = require(BASE + 'model/lineaPedido');
const FieldChecker = require(BASE + 'util/fieldChecker');
const crypto = require('crypto');

const L = global.logger;

function parseLines( json, txId ) {
	var lineas = [];
	function rellena ( lineas ) {

		json.lineas.forEach( function (linea) {
			lineas.push(new LineaPedido(linea, txId));
		});

		return lineas;
	}
	return rellena( lineas );
}


class Pedido {

	constructor(req) {

		var json = req.body;

		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();
		FieldChecker.checkExists(json.codigoCliente, fedicomError, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, fedicomError, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
		FieldChecker.checkExists(json.numeroPedidoOrigen, fedicomError, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')

		if (fedicomError.hasError()) {
			L.xe(req.txId, ['El pedido contiene errores. Se aborta el procesamiento del mismo', fedicomError]);
			throw fedicomError;
		}
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// INFORMACION DE LOGIN INCLUIDA EN EL PEDIDO
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		// SANEADO DE LINEAS
		var lineas = parseLines( json, req.txId );
		this.lineas = lineas;

		// GENERACION DE CRC
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.codigoCliente + this.numeroPedidoOrigen).digest('hex').substring(0,24).toUpperCase();
		L.xd(req.txId, ['Se asigna el siguiente CRC para el pedido', this.crc], 'txCRC')
	}


}

module.exports = Pedido;
