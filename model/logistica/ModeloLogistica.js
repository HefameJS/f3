'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const clone = require('clone');

// Modelos
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');
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
		let fedicomError = new ErrorFedicom();

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
		let [lineas, ignorarTodasLineas] = _analizarPosiciones(txId, json);
		this.lineas = lineas;
		this.ignorarTodasLineas = ignorarTodasLineas;
	
		// GENERACION DE CRC
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
		let incidenciasCabecera = PreCleaner.clean(txId, this, K.PRE_CLEAN.LOGISTICA.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaLogistica) => {
				let incidenciasLinea = PreCleaner.clean(txId, lineaLogistica, K.PRE_CLEAN.LOGISTICA.LINEAS);
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

const _analizarPosiciones = (txId, json) => {
	let lineas = [];
	let ordenes = [];
	let ignorarTodasLineas = true;

	json.lineas.forEach((linea, i) => {
		let nuevaLinea = new LineaLogistica(txId, linea);
		lineas.push(nuevaLinea);
		if (!nuevaLinea.sap_ignore) ignorarTodasLineas = false;

		if (nuevaLinea.orden) {
			ordenes.push(parseInt(nuevaLinea.orden));
		}
	})

	let nextOrder = 1;
	lineas.forEach((linea) => {
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
	sanearMayusculas: (respuestaCliente) => {
		K.POST_CLEAN.LOGISTICA.replaceCab.forEach(nombreCampo => {
			let nombreCampoMinusculas = nombreCampo.toLowerCase();
			if (respuestaCliente[nombreCampoMinusculas] !== undefined) {
				respuestaCliente[nombreCampo] = respuestaCliente[nombreCampoMinusculas];
				delete respuestaCliente[nombreCampoMinusculas];
			}
		});

		// Saneado de las mayúsculas en las direcciones de origen y destino
		K.POST_CLEAN.LOGISTICA.replaceDireccionLogistica.forEach(nombreCampo => {
			let nombreCampoMinusculas = nombreCampo.toLowerCase();
			if (respuestaCliente.origen[nombreCampoMinusculas] !== undefined) {
				respuestaCliente.origen[nombreCampo] = respuestaCliente.origen[nombreCampoMinusculas];
				delete respuestaCliente.origen[nombreCampoMinusculas];
			}
			if (respuestaCliente.destino[nombreCampoMinusculas] !== undefined) {
				respuestaCliente.destino[nombreCampo] = respuestaCliente.destino[nombreCampoMinusculas];
				delete respuestaCliente.destino[nombreCampoMinusculas];
			}
		})


		if (respuestaCliente.lineas) {
			respuestaCliente.lineas.forEach((linea) => {
				K.POST_CLEAN.LOGISTICA.replacePos.forEach((nombreCampo) => {
					let nombreCampoMinusculas = nombreCampo.toLowerCase();
					if (linea[nombreCampoMinusculas] !== undefined) {
						linea[nombreCampo] = linea[nombreCampoMinusculas];
						delete linea[nombreCampoMinusculas];
					}
				});
			});
		}
		return respuestaCliente;

	},
	eliminarCamposInnecesarios: (respuestaCliente) => {
		K.POST_CLEAN.LOGISTICA.removeCab.forEach(campo => {
			delete respuestaCliente[campo];
		});
		K.POST_CLEAN.LOGISTICA.removeCabEmptyString.forEach(campo => {
			if (respuestaCliente[campo] === '') delete respuestaCliente[campo];
		});
		K.POST_CLEAN.LOGISTICA.removeCabEmptyArray.forEach(campo => {
			if (respuestaCliente[campo] && typeof respuestaCliente[campo].push === 'function' && respuestaCliente[campo].length === 0) delete respuestaCliente[campo];
		});
		K.POST_CLEAN.LOGISTICA.removeCabZeroValue.forEach(campo => {
			if (respuestaCliente[campo] === 0) delete respuestaCliente[campo];
		});
		K.POST_CLEAN.LOGISTICA.removeCabIfFalse.forEach(campo => {
			if (respuestaCliente[campo] === false) delete respuestaCliente[campo];
		});

		// Limpieza de campos vacíos en las direcciones de origen y destino
		K.POST_CLEAN.LOGISTICA.removeDireccionLogisticaEmptyString.forEach(field => {
			if (respuestaCliente.origen[field] === '') delete respuestaCliente.origen[field];
			if (respuestaCliente.destino[field] === '') delete respuestaCliente.destino[field];
		});

		if (respuestaCliente.lineas && respuestaCliente.lineas.forEach) {
			respuestaCliente.lineas.forEach( linea => {
				K.POST_CLEAN.LOGISTICA.removePos.forEach(campo => {
					delete linea[campo];
				});
				K.POST_CLEAN.LOGISTICA.removePosEmptyString.forEach(campo => {
					if (linea[campo] === '') delete linea[campo];
				});
				K.POST_CLEAN.LOGISTICA.removePosEmptyArray.forEach(campo => {
					if (linea[campo] && typeof linea[campo].push === 'function' && linea[campo].length === 0) delete linea[campo];
				});
				K.POST_CLEAN.LOGISTICA.removePosZeroValue.forEach(campo => {
					if (linea[campo] === 0) delete linea[campo];
				});
				K.POST_CLEAN.LOGISTICA.removePosIfFalse.forEach(campo => {
					if (linea[campo] === false) delete linea[campo];
				});

			});
		}
		return respuestaCliente;
	}
}


const obtenerEstadoDeRespuestaSap = (respuestaSap) => {

	let estadoTransmision = K.TX_STATUS.OK;
	let codigoHttpRespuesta = 201;
	let numeroLogistica = respuestaSap.numerologistica; // Ojo: respuestaSap tiene los campos en minusculas !

	return [estadoTransmision, numeroLogistica, codigoHttpRespuesta];
}

module.exports = Logistica;
