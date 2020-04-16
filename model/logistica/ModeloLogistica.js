'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const clone = require('clone');

// Modelos
const FedicomError = require(BASE + 'model/fedicomError');
const CRC = require(BASE + 'model/CRC');
const LineaLogistica = require('./ModeloLineaLogistica');
const DireccionLogistica = require('./ModeloDireccionLogistica');


// Helpers
const PreCleaner = require(BASE + 'transmutes/preCleaner');
const FieldChecker = require(BASE + 'util/fieldChecker');

class Logistica {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		// SANEADO OBLIGATORIO
		let fedicomError = new FedicomError();

		FieldChecker.checkNotEmptyString(json.codigoCliente, fedicomError, 'LOG-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkNotEmptyString(json.numeroLogisticaOrigen, fedicomError, 'LOG-ERR-003', 'El campo "numeroLogisticaOrigen" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, fedicomError, 'LOG-ERR-004', 'El campo "lineas" no puede estar vacío');

		let direccionOrigen = new DireccionLogistica(txId, json.origen);
		if (direccionOrigen.esErronea()) fedicomError.add('LOG-ERR-005', 'La dirección de origen no es correcta', 400);

		let direccionDestino = new DireccionLogistica(txId, json.destino);
		if (direccionDestino.esErronea()) fedicomError.add('LOG-ERR-006', 'La dirección de destino no es correcta', 400);

		if (fedicomError.hasError()) {
			L.xe(txId, 'La solicitud logística contiene errores. Se aborta el procesamiento de la misma');
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
		let [lineas, ignorarTodasLineas] = _procesarLineas(txId, json);
		this.lineas = lineas;
		this.ignorarTodasLineas = ignorarTodasLineas;
	
		// GENERACION DE CRC DESHABILITADA
		this.generarCRC()
	}

	generarCRC() {
		this.crc = CRC.crear(this.codigoCliente, this.numeroLogisticaOrigen);
	}

	contienteLineasValidas() {
		return !this.ignorarTodasLineas;
	}



	limpiarEntrada(txId) {

		// LIMPIEZA DE LOS CAMPOS DE CABECERA
		var incidenciasCabecera = PreCleaner.clean(txId, this, K.PRE_CLEAN.LOGISTICA.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaLogistica) => {
				var incidenciasLinea = PreCleaner.clean(txId, lineaLogistica, K.PRE_CLEAN.LOGISTICA.LINEAS);
				if (incidenciasLinea.hasError()) {
					if (lineaLogistica.incidencias && lineaLogistica.incidencias.concat) {
						lineaLogistica.incidencias.concat(incidenciasLinea.getErrors());
					} else {
						lineaLogistica.incidencias = incidenciasLinea.getErrors();
					}
				}
			});
		}

	}

	obtenerRespuestaCliente(txId, respuestaSAP) {

		let respuestaCliente = clone(respuestaSAP);

		respuestaCliente = SaneadorLogisticaSAP.sanearMayusculas(respuestaCliente);
		respuestaCliente = SaneadorLogisticaSAP.eliminarCamposInnecesarios(respuestaCliente);

		respuestaCliente.estadoTransmision = () => { return obtenerEstadoDeRespuestaSap(respuestaSAP) }
		respuestaCliente.isRechazadoSap = () => false;
		return respuestaCliente;
	}


}

const _procesarLineas = (txId, json) => {
	let lineas = [];
	let ordenes = [];
	let ignorarTodasLineas = true;

	json.lineas.forEach((linea, i) => {
		let nuevaLinea = new LineaLogistica(txId, linea, i);
		lineas.push(nuevaLinea);
		if (!nuevaLinea.sap_ignore) ignorarTodasLineas = false;

		if (nuevaLinea.orden) {
			ordenes.push(parseInt(nuevaLinea.orden));
		}
	})

	let nextOrder = 1;
	lineas.forEach(function (linea) {
		if (!linea.orden) {
			while (ordenes.includes(nextOrder)) {
				nextOrder++;
			}
			linea.orden = nextOrder;
			nextOrder++;
		}
	});

	return [lineas, ignorarTodasLineas];
}


/**
 * Funciones para sanear la respuesta de SAP y obtener la respuesta que se
 * va a dar realmente al cliente.
 */
const SaneadorLogisticaSAP = {
	sanearMayusculas: (message) => {
		K.POST_CLEAN.LOGISTICA.replaceCab.forEach(field => {
			let fieldLowerCase = field.toLowerCase();
			if (message[fieldLowerCase] !== undefined) {
				message[field] = message[fieldLowerCase];
				delete message[fieldLowerCase];
			}
		});

		// Saneado de las mayúsculas en las direcciones de origen y destino
		K.POST_CLEAN.LOGISTICA.replaceDireccionLogistica.forEach(field => {
			let fieldLowerCase = field.toLowerCase();
			if (message.origen[fieldLowerCase] !== undefined) {
				message.origen[field] = message.origen[fieldLowerCase];
				delete message.origen[fieldLowerCase];
			}
			if (message.destino[fieldLowerCase] !== undefined) {
				message.destino[field] = message.destino[fieldLowerCase];
				delete message.destino[fieldLowerCase];
			}
		})


		if (message.lineas) {
			message.lineas.forEach(function (linea) {
				K.POST_CLEAN.LOGISTICA.replacePos.forEach(function (field) {
					let fieldLowerCase = field.toLowerCase();
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
		K.POST_CLEAN.LOGISTICA.removeCab.forEach(field => {
			delete message[field];
		});
		K.POST_CLEAN.LOGISTICA.removeCabEmptyString.forEach(field => {
			if (message[field] === '') delete message[field];
		});
		K.POST_CLEAN.LOGISTICA.removeCabEmptyArray.forEach(field => {
			if (message[field] && typeof message[field].push === 'function' && message[field].length === 0) delete message[field];
		});
		K.POST_CLEAN.LOGISTICA.removeCabZeroValue.forEach(field => {
			if (message[field] === 0) delete message[field];
		});
		K.POST_CLEAN.LOGISTICA.removeCabIfFalse.forEach(field => {
			if (message[field] === false) delete message[field];
		});

		// Limpieza de campos vacíos en las direcciones de origen y destino
		K.POST_CLEAN.LOGISTICA.removeDireccionLogisticaEmptyString.forEach(field => {
			if (message.origen[field] === '') delete message.origen[field];
			if (message.destino[field] === '') delete message.destino[field];
		});

		if (message.lineas && message.lineas.forEach) {
			message.lineas.forEach( linea => {
				K.POST_CLEAN.LOGISTICA.removePos.forEach(field => {
					delete linea[field];
				});
				K.POST_CLEAN.LOGISTICA.removePosEmptyString.forEach(field => {
					if (linea[field] === '') delete linea[field];
				});
				K.POST_CLEAN.LOGISTICA.removePosEmptyArray.forEach(field => {
					if (linea[field] && typeof linea[field].push === 'function' && linea[field].length === 0) delete linea[field];
				});
				K.POST_CLEAN.LOGISTICA.removePosZeroValue.forEach(field => {
					if (linea[field] === 0) delete linea[field];
				});
				K.POST_CLEAN.LOGISTICA.removePosIfFalse.forEach(field => {
					if (linea[field] === false) delete linea[field];
				});

			});
		}
		return message;
	}
}


const obtenerEstadoDeRespuestaSap = (respuestaSap) => {

	let estadoTransmision = K.TX_STATUS.OK;
	let codigoHttpRespuesta = 201;
	let numeroLogistica = respuestaSap.numerologistica; // Ojo: respuestaSap tiene los campos en minusculas !

	return [estadoTransmision, numeroLogistica, codigoHttpRespuesta];
}

module.exports = Logistica;
