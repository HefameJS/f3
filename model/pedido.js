'use strict';

const FedicomError = require('./fedicomError');
const LineaPedido = require('./lineaPedido');
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
		if (!json.codigoCliente) {
			L.xw(req.txId, 'Error al analizar la peticion', 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
			fedicomError.add('PED-ERR-002', 'El campo "codigoCliente" es obligatorio', 400);
		}
		// if (!json.tipoPedido) fedicomError.add('PED-ERR-003', 'El campo "tipoPedido" es obligatorio', 400);
		if (!json.lineas || json.lineas.length === 0) {
			L.xw(req.txId, 'Error al analizar la peticion', 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
			fedicomError.add('PED-ERR-004', 'El campo "lineas" no puede estar vacío', 400);
		}
		if (!json.numeroPedidoOrigen) {
			L.xw(req.txId, 'Error al analizar la peticion', 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
			fedicomError.add('PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio', 400);
		}
		if (fedicomError.hasError()) {
			L.xe(req.txId, 'El pedido contiene errores. Se aborta el procesamiento del mismo');
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


	addIncidencia( err ) {
		if (!this.incidencias) this.incidencias = err.getErrors();
		else this.incidencias.merge(err);
	}

}

module.exports = Pedido;
