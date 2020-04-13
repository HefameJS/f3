'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');
const LineaDevolucion = require(BASE + 'model/devolucion/ModeloLineaDevolucion');

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
	var [lineas, lineasExcluidas/*, crc*/] = parseLines(json, req.txId);
		this.lineas = lineas;
		this.lineasExcluidas = lineasExcluidas
	
		// GENERACION DE CRC DESHABILITADA
		/*
		var timestamp = Math.floor(Date.fedicomTimestamp() / 10000); // Con esto redondeamos mas o menos a 100 segundos
		var hash = crypto.createHash('sha1');
		this.crc = hash.update(crc + this.codigoCliente + timestamp).digest('hex').substring(0, 24).toUpperCase();
		L.xd(req.txId, ['Se asigna el siguiente CRC para la devolución', this.crc], 'txCRC');
		*/
		this.crc = crypto.createHash('sha1').update(Math.random()+"").digest('hex').substring(0, 24).toUpperCase();
	}

	contienteLineasValidas() {
		return this.lineas.length > 0
	}

	generarRespuestaExclusiones() {
		return {
			codigoCliente: this.codigoCliente,
			lineas: this.lineasExcluidas
		}
	}

	limpiarEntrada(txId) {

		// LIMPIEZA DE LOS CAMPOS DE CABECERA
		var incidenciasCabecera = PreCleaner.clean(txId, this, K.PRE_CLEAN.DEVOLUCIONES.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaDevolucion) => {
				var incidenciasLinea = PreCleaner.clean(txId, lineaDevolucion, K.PRE_CLEAN.DEVOLUCIONES.LINEAS);
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

	obtenerRespuestaCliente(txId, respuestaSAP) {

		// Comprobamos si SAP ha devuelto un error de "cliente desconocido"
		if (respuestaSAP[0] && respuestaSAP[0].incidencias[0] && respuestaSAP[0].incidencias[0].descripcion === "Cliente desconocido") {
			L.xw(txId, 'Se encontró un error de cliente desconocido en la respuesta de SAP')
			let error = new FedicomError('DEV-ERR-002', 'El parámetro "codigoCliente" es inválido')
			respuestaSAP = error.getErrors()
			respuestaSAP.estadoTransmision = () => { return [K.TX_STATUS.RECHAZADO_SAP, [], 400] }
			respuestaSAP.isRechazadoSap = () => true;
			return respuestaSAP;
		}

		respuestaSAP.forEach(devolucion => {
			devolucion = SaneadorDevolucionesSAP.sanearMayusculas(devolucion);
			devolucion = SaneadorDevolucionesSAP.eliminarCamposInnecesarios(devolucion);
		})

		let estado = K.TX_STATUS.OK;

		// Si se excluyeron lineas, generamos una devolución sin número donde incluimos 
		// las lineas que quedaron excluidas y el motivo
		if (this.lineasExcluidas.length > 0) {
			respuestaSAP.push(this.generarRespuestaExclusiones());
			estado = K.TX_STATUS.DEVOLUCION.PARCIAL
		}



		respuestaSAP.estadoTransmision = () => { return obtenerEstadoDeRespuestaSap(respuestaSAP, estado) }
		respuestaSAP.isRechazadoSap = () => false;
		return respuestaSAP;
	}


}

const parseLines = (json, txId) => {
	var lineas = [];
	var lineasExcluidas = [];
	// var crc = '';
	var ordenes = [];

	function rellena(lineas) {

		json.lineas.forEach(function (linea, i) {
			var nuevaLinea = new LineaDevolucion(linea, txId, i);

			// var hash = crypto.createHash('sha1');
			// crc = hash.update(crc + nuevaLinea.crc).digest('hex');

			if (nuevaLinea.excluir) {
				// delete nuevaLinea.crc;
				delete nuevaLinea.excluir;
				lineasExcluidas.push(nuevaLinea);

			} else {
				lineas.push(nuevaLinea);
			}


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

		return [lineas, lineasExcluidas/*, crc*/];
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

		// Limpieza de incidencias si vienen con algún campo vacío
		/* Por ejemplo, si se manda un CN6+1, SAP responde: {
			"codigo": "LIN-DEV-WARN-999",
			"descripcion": ""
		}
		*/
		if (message.incidencias && message.incidencias.forEach) {
			let incidenciasSaneadas = []
			message.incidencias.forEach(incidencia => {
				if (incidencia && incidencia.codigo && incidencia.descripcion) {
					incidenciasSaneadas.push(incidencia);
				}
			})
			if (incidenciasSaneadas.length > 0)
				message.incidencias = incidenciasSaneadas;
			else
				delete message.incidencias;
		}

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

				// Limpieza de incidencias si vienen con algún campo vacío
				/* Por ejemplo, si se manda un CN6+1, SAP responde: {
					"codigo": "LIN-DEV-WARN-999",
					"descripcion": ""
				}
				*/
				if (linea.incidencias && linea.incidencias.forEach) {
					let incidenciasSaneadas = []
					linea.incidencias.forEach( incidencia => {
						if (incidencia && incidencia.codigo && incidencia.descripcion) {
							incidenciasSaneadas.push(incidencia);
						}
					})

					if (incidenciasSaneadas.length > 0)
						linea.incidencias = incidenciasSaneadas;
					else
						delete linea.incidencias;
				}
			});
		}
		return message;
	}
}


const obtenerEstadoDeRespuestaSap = (sapBody, estado) => {

	let estadoTransmision = estado || K.TX_STATUS.OK;
	let codigoHttpRespuesta = estadoTransmision === K.TX_STATUS.OK ? 201 : 206;

	let numerosDevolucion = [];
	if (sapBody && sapBody.length > 0) {
		sapBody.forEach(function (devolucion) {
			if (devolucion && devolucion.numeroDevolucion) {
				numerosDevolucion.push(devolucion.numeroDevolucion);
			}
		});
	}

	return [estadoTransmision, numerosDevolucion, codigoHttpRespuesta];
}

module.exports = Devolucion;
