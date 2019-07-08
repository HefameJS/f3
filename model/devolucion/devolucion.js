'use strict';
const BASE = global.BASE;
const FedicomError = require(BASE + 'model/fedicomError');
const LineaDevolucion = require(BASE + 'model/devolucion/lineaDevolucion');
const crypto = require('crypto');

const L = global.logger;


class Devolucion {

	constructor(req) {

		var json = req.body;

		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();
		if (!json.codigoCliente) {
			L.xw(req.txId, 'Error al analizar la petición', 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
			fedicomError.add('PED-ERR-002', 'El campo "codigoCliente" es obligatorio', 400);
		}
		if (!json.lineas || json.lineas.length === 0) {
			L.xw(req.txId, 'Error al analizar la petición', 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
			fedicomError.add('PED-ERR-004', 'El campo "lineas" no puede estar vacío', 400);
		}

		if (fedicomError.hasError()) {
			L.xe(req.txId, 'La devolución contiene errores. Se aborta el procesamiento de la misma');
			throw fedicomError;
		}
		// FIN DE SANEADO

		// COPIA DE PROPIEDADES
		Object.assign(this, json);

		// INFORMACION DE LOGIN INCLUIDA EN LA DEVOLUCION
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		// SANEADO DE LINEAS
		var [lineas, crc] = this.parseLines( json, req.txId );
		this.lineas = lineas;
		this.crc = crc;

		// SANEADO DEL NUMERO DE CLIENTE
		if (this.codigoCliente.endsWith('@hefame')) {
			L.xd(req.txId, "Saneando el codigo del cliente porque acaba en '@hefame'");
			this.codigoCliente = this.codigoCliente.substring(0, this.codigoCliente.length - 7);
		}

		// GENERACION DE CRC
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.crc + this.codigoCliente).digest('hex').substring(0,24).toUpperCase();
		L.xd(req.txId, ['Se asigna el siguiente CRC para la devolución', this.crc], 'txCRC');
	}


	parseLines( json, txId ) {
		var lineas = [];
		var crc = '';
		var hash = crypto.createHash('sha1');
		function rellena ( lineas ) {

			json.lineas.forEach( function (linea) {
				var nuevaLinea = new LineaDevolucion(linea, txId);
				lineas.push(nuevaLinea);
				crc = hash.update(crc + nuevaLinea.crc).digest('hex');
			});

			return [lineas, crc];
		}
		return rellena( lineas );
	}

	addIncidencia( err ) {
		if (!this.incidencias) this.incidencias = err.getErrors();
		else this.incidencias.merge(err);
	}

}

module.exports = Devolucion;
