'use strict';

const FedicomError = require('./fedicomError');
const LineaPedido = require('./lineaPedido');
const crypto = require('crypto');

function parseLines( json ) {
	var lineas = [];
	function rellena ( lineas ) {

		json.lineas.forEach( function (linea) {
			lineas.push(new LineaPedido(linea));
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
		if (!json.codigoCliente) fedicomError.add('PED-ERR-002', 'El campo "codigoCliente" es obligatorio', 400);
		// if (!json.tipoPedido) fedicomError.add('PED-ERR-003', 'El campo "tipoPedido" es obligatorio', 400);
		if (!json.lineas || json.lineas.length === 0) fedicomError.add('PED-ERR-004', 'El campo "lineas" no puede estar vacío', 400);
		if (!json.numeroPedidoOrigen) fedicomError.add('PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio', 400);
		if (fedicomError.hasError()) throw fedicomError;
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// INFORMACION DE LOGIN INCLUIDA EN EL PEDIDO
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		// SANEADO DE LINEAS
		var lineas = parseLines( json );
		this.lineas = lineas;

		// GENERACION DE CRC
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.codigoCliente + this.numeroPedidoOrigen).digest('hex').substring(0,24).toUpperCase();
	}


	addIncidencia( err ) {
		if (!this.incidencias) this.incidencias = err.getErrors();
		else this.incidencias.merge(err);
	}

}

module.exports = Pedido;
