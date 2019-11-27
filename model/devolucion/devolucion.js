'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');
const LineaDevolucion = require(BASE + 'model/devolucion/lineaDevolucion');

const PreCleaner = require(BASE + 'transmutes/preCleaner');
const FieldChecker = require(BASE + 'util/fieldChecker');
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
		var [lineas, crc] = parseLines( json, req.txId );
		this.lineas = lineas;
		this.crc = crc;

		// GENERACION DE CRC
		var timestamp = Math.floor(Date.fedicomTimestamp() / 100000); // Con esto redondeamos mas o menos a 16.6 minutos
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(this.crc + this.codigoCliente + timestamp).digest('hex').substring(0,24).toUpperCase();
		L.xd(req.txId, ['Se asigna el siguiente CRC para la devolución', this.crc], 'txCRC');
	}

	limpiarEntrada() {

		// LIMPIEZA DE LOS CAMPOS DE CABECERA
		var incidenciasCabecera = PreCleaner.clean(this, K.PRE_CLEAN.DEVOLUCIONES.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaDevolucion) => {
				var incidenciasLinea = PreCleaner.clean(lineaDevolucion, K.PRE_CLEAN.DEVOLUCIONES.LINEAS);
				if (incidenciasLinea.hasError()) {
					if (lineaDevolucion.incidencias && lineaDevolucion.incidencias.concat) {
						lineaDevolucion.incidencias.concat(incidenciasLinea.getErrors());
					} else {
						lineaDevolucion.incidencias = incidenciasLinea.getErrors();
					}
				}
			});
		}

	}

	obtenerRespuestaCliente(respuestaSAP) {
		respuestaSAP.forEach(function (devolucion) {
			devolucion = SaneadorDevolucionesSAP.sanearMayusculas(devolucion);
			devolucion = SaneadorDevolucionesSAP.eliminarCamposInnecesarios(devolucion);
		})
		respuestaSAP.estadoTransmision = () => { return obtenerEstadoDeRespuestaSap(respuestaSAP) }
		respuestaSAP.isRechazadoSap = () => true;
		return respuestaSAP;
	}


}

const parseLines = (json, txId) => {
	var lineas = [];
	var crc = '';
	var ordenes = [];

	function rellena(lineas) {

		json.lineas.forEach(function (linea, i) {
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
		lineas.forEach(function (linea) {
			if (!linea.orden) {
				while (ordenes.includes(nextOrder)) {
					nextOrder++;
				}
				linea.orden = nextOrder;
				nextOrder++;
			}
		});

		return [lineas, crc];
	}
	return rellena(lineas);
}


/**
 * Funciones para sanear la respuesta de SAP y obtener la respuesta que se
 * va a dar realmente al cliente.
 */
const SaneadorDevolucionesSAP = {
	sanearMayusculas: (message) => {
		K.POST_CLEAN.DEVOLUCIONES.replaceCab.forEach(function (field) {
			var fieldLowerCase = field.toLowerCase();
			if (message[fieldLowerCase] !== undefined) {
				message[field] = message[fieldLowerCase];
				delete message[fieldLowerCase];
			}
		});

		if (message.lineas) {
			message.lineas.forEach(function (linea) {
				K.POST_CLEAN.DEVOLUCIONES.replacePos.forEach(function (field) {
					var fieldLowerCase = field.toLowerCase();
					if (linea[fieldLowerCase] !== undefined) {
						linea[field] = linea[fieldLowerCase];
						delete linea[fieldLowerCase];
					}
				});
			});
		}
		return message;

	},
	eliminarCamposInnecesarios: (message) => {
		K.POST_CLEAN.DEVOLUCIONES.removeCab.forEach(function (field) {
			delete message[field];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabEmptyString.forEach(function (field) {
			if (message[field] === '') delete message[field];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabEmptyArray.forEach(function (field) {
			if (typeof message[field].push === 'function' && message[field].length === 0) delete message[field];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabZeroValue.forEach(function (field) {
			if (message[field] === 0) delete message[field];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabIfFalse.forEach(function (field) {
			if (message[field] === false) delete message[field];
		});

		if (message.lineas && message.lineas.forEach) {
			message.lineas.forEach(function (linea) {
				K.POST_CLEAN.DEVOLUCIONES.removePos.forEach(function (field) {
					delete linea[field];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosEmptyString.forEach(function (field) {
					if (linea[field] === '') delete linea[field];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosEmptyArray.forEach(function (field) {
					if (linea[field] && typeof linea[field].push === 'function' && linea[field].length === 0) delete linea[field];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosZeroValue.forEach(function (field) {
					if (linea[field] === 0) delete linea[field];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosIfFalse.forEach(function (field) {
					if (linea[field] === false) delete linea[field];
				});
			});
		}
		return message;
	}
}


const obtenerEstadoDeRespuestaSap = (sapBody) => {

	var estadoTransmision = K.TX_STATUS.OK;

	var numerosDevolucion = [];
	if (sapBody && sapBody.length > 0) {
		sapBody.forEach(function (devolucion) {
			if (devolucion && devolucion.numeroDevolucion) {
				numerosDevolucion.push(devolucion.numeroDevolucion);
			}
		});
	}

	return [estadoTransmision, numerosDevolucion];
}

module.exports = Devolucion;
