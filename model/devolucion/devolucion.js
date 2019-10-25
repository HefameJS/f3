'use strict';
const BASE = global.BASE;
// const config = global.config;
const L = global.logger;

const FedicomError = require(BASE + 'model/fedicomError');
const LineaDevolucion = require(BASE + 'model/devolucion/lineaDevolucion');
const FieldChecker = require(BASE + 'util/fieldChecker');
const cleanerDevolucion = require(BASE + 'util/cleaner/cleanerDevolucion');
const crypto = require('crypto');



class Devolucion {

	constructor(req) {

		var json = req.body;

		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();

		FieldChecker.checkNotEmptyString(json.codigoCliente, fedicomError, 'DEV-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, fedicomError, 'DEV-ERR-003', 'El campo "lineas" no puede estar vacío');

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

		// GENERACION DE CRC
		var timestamp = Math.floor(Date.fedicomTimestamp() / 100000); // Con esto redondeamos mas o menos a 16.6 minutos
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.crc + this.codigoCliente + timestamp).digest('hex').substring(0,24).toUpperCase();
		L.xd(req.txId, ['Se asigna el siguiente CRC para la devolución', this.crc], 'txCRC');
	}

	clean() {
		cleanerDevolucion(this);
	}

	parseLines( json, txId ) {
		var lineas = [];
		var crc = '';
		var ordenes = [];

		function rellena ( lineas ) {

			json.lineas.forEach( function (linea, i) {
				var nuevaLinea = new LineaDevolucion(linea, txId, i);
				lineas.push(nuevaLinea);
				var hash = crypto.createHash('sha1');
				crc = hash.update(crc + nuevaLinea.crc).digest('hex');

				// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
				if (nuevaLinea.orden) {
					ordenes.push(parseInt(nuevaLinea.orden));
				}

			});

			// Rellenamos el orden en las lineas donde no viene.
			var nextOrder = 1;
			lineas.forEach( function (linea) {
				if (!linea.orden) {
					while (ordenes.includes(nextOrder)) {
						nextOrder ++;
					}
					linea.orden = nextOrder;
					nextOrder ++;
				}
			});

			return [lineas, crc];
		}
		return rellena( lineas );
	}


}

module.exports = Devolucion;
