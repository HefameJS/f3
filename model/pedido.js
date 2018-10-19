'use strict';

const FedicomError = require('./FedicomError');
const LineaPedido = require('./lineaPedido');
const crypto = require('crypto');

function parseLines( json ) {
	var r;
	function rellena ( r ) {
		r = {
			incidences: new FedicomError(),
			lineas: []
		};
		json.lineas.forEach( function (e) {
			console.log("----");
			console.log(e);
			try {
				r.lineas.push(new LineaPedido(e));
			} catch (error) {
				console.log(error);
				r.incidences.merge(error);
			}
		});
		console.log(r);
		return r;
	}
	return rellena( r );
}


class Pedido {

	constructor(json) {
		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();
		if (!json.codigoCliente) fedicomError.add('PED-ERR-002', 'El campo "codigoCliente" es obligatorio', 400);
		if (!json.tipoPedido) fedicomError.add('PED-ERR-003', 'El campo "tipoPedido" es obligatorio', 400);
		if (!json.lineas || json.lineas.length === 0) fedicomError.add('PED-ERR-004', 'El campo "lineas" no puede estar vacío', 400);
		if (!json.numeroPedidoOrigen) fedicomError.add('PED-ERR-005', 'El campo "numeroPedidoOrigen" es obligatorio', 400);
		if (fedicomError.hasError())	throw fedicomError;
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// SANEADO DE LINEAS
		var res = parseLines( json );
		this.lineas = res.lineas;
		if (res.incidences.hasError()) this.incidencias = res.incidences.getErrors();

		// GENERACION DE CRC
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.codigoCliente + this.numeroPedidoOrigen).digest('hex').substring(0,24).toUpperCase();
	}

	setLoginData(token) {
		this.login = {
			username: token.sub,
			domain: token.dom
		}
	}

	addIncidencia( err ) {
		if (!this.incidencias) this.incidencias = err.getErrors();
		else this.incidencias.merge(err);
	}

}

module.exports = Pedido;
