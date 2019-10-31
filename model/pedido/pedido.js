'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const FedicomError = require(BASE + 'model/fedicomError');
const LineaPedido = require(BASE + 'model/pedido/lineaPedido');
const FieldChecker = require(BASE + 'util/fieldChecker');
const cleanerPedido = require(BASE + 'util/cleaner/cleanerPedido');
const crypto = require('crypto');

function parseLines( json, txId ) {
	var lineas = [];
	var ordenes = [];
	function rellena ( lineas ) {

		json.lineas.forEach( function (linea) {
			var lineaPedido = new LineaPedido(linea, txId);
			lineas.push(lineaPedido);

			// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
			if (lineaPedido.orden) {
				ordenes.push(parseInt(lineaPedido.orden));
			}
		});

		// Rellenamos el orden.
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
		return lineas;
	}
	return rellena( lineas );
}


class Pedido {

	constructor(req) {

		var json = req.body;

		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();
		FieldChecker.checkNotEmptyString(json.codigoCliente, fedicomError, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, fedicomError, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
		FieldChecker.checkNotEmptyString(json.numeroPedidoOrigen, fedicomError, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')

		if (json.codigoCliente && json.codigoCliente.endsWith('@hefame')) {
			fedicomError.add('PED-ERR-002', 'Indique el "codigoCliente" que no lleva @hefame al final', 400);
		}


		if (fedicomError.hasError()) {
			L.xe(req.txId, ['El pedido contiene errores. Se aborta el procesamiento del mismo', fedicomError]);
			throw fedicomError;
		}

		// SANEADO OBLIGATORIO DE LINEAS
		var lineas = parseLines(json, req.txId);



		// COPIA DE PROPIEDADES
		Object.assign(this, json);
		this.lineas = lineas;


		// INFORMACION DE LOGIN INCLUIDA EN EL PEDIDO
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		// GENERACION DE CRC
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.codigoCliente + this.numeroPedidoOrigen).digest('hex').substring(0,24).toUpperCase();
		L.xd(req.txId, ['Se asigna el siguiente CRC para el pedido', this.crc], 'txCRC')

		// INCLUYE LA URL DE CONFIRMACION PARA SAP
		this.includeConfirmationUrl();

		// ARREGLO DEL ALMACEN
		this.conversionNumeroAlmacen();
	}

	simulaFaltas() {
		this.lineas.forEach( function (linea) {
			linea.simulaFaltas();
		});
		var fedicomError = {codigo: 'PED-WARN-999', descripcion: 'Pedido recibido - Incidencias no disponibles'};
		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push( fedicomError );
		} else {
			this.incidencias = [fedicomError];
		}
		this.fechaPedido = Date.toFedicomDateTime();
		this.numeroPedido = this.crc;
		delete this.crc;
		delete this.login;
	}

	includeConfirmationUrl() {
		var os = require('os');
		this.sap_url_confirmacion = 'https://' + os.hostname() + '.hefame.es:' + config.https.port + '/confirmaPedido';
	}

	conversionNumeroAlmacen() {
		console.log(this.codigoAlmacenServicio);
		if (this.codigoAlmacenServicio) {
			this.codigoAlmacenServicio = this.codigoAlmacenServicio.trim();
			if (!this.codigoAlmacenServicio.startsWith('RG')) {
				var codigoFedicom2 = parseInt(this.codigoAlmacenServicio);
				switch (codigoFedicom2) {
					case 2: this.codigoAlmacenServicio = 'RG01'; break; // Santomera
					case 5: this.codigoAlmacenServicio = 'RG15'; break; // Barcelona viejo
					case 9: this.codigoAlmacenServicio = 'RG19'; break; // Málaga viejo
					case 13: this.codigoAlmacenServicio = 'RG04'; break; // Madrid viejo
					case 3: /* Cartagena */
					case 4: /* Madrid nuevo */
					case 6: /* Alicante */
					case 7: /* Almería */
					case 8: /* Albacete */
					case 10: /* Valencia */
					case 15: /* Barcelona */
					case 16: /* Tortosa */
					case 17: /* Melilla */
					case 18: /* Granada */
					case 19: /* Malaga nuevo */
						this.codigoAlmacenServicio = 'RG' + (codigoFedicom2 > 9 ? codigoFedicom2 : '0' + codigoFedicom2);
						break;
					default: 
						delete this.codigoAlmacenServicio; 
						this.addIncidencia('PED-WARN-999', 'No se reconoce el código de almacén indicado.');
						break;
				}
			}
		}
		console.log(this.codigoAlmacenServicio);
	}

	clean() {
		cleanerPedido(this);
	}

	addIncidencia(code, descripcion) {
		var incidencia = new FedicomError(code, descripcion);
		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push( incidencia.getErrors()[0] )
		} else {
			this.incidencias = incidencia.getErrors();
		}
	}

}

module.exports = Pedido;
