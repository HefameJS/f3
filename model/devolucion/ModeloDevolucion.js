'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const clone = require('clone');

// Interfaces
const iFlags = require('interfaces/iFlags');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');
const LineaDevolucion = require('./ModeloLineaDevolucion');
const CRC = require('model/CRC');

// Helpers
const PreCleaner = require('transmutes/preCleaner');
const FieldChecker = require('util/fieldChecker');




class Devolucion {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		// SANEADO OBLIGATORIO
		let errorFedicom = new ErrorFedicom();

		FieldChecker.checkNotEmptyString(json.codigoCliente, errorFedicom, 'DEV-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, errorFedicom, 'DEV-ERR-003', 'El campo "lineas" no puede estar vacío');

		if (errorFedicom.hasError()) {
			L.xe(txId, 'La devolución contiene errores. Se aborta el procesamiento de la misma');
			throw errorFedicom;
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
		let [lineas, lineasExcluidas, crc] = _analizarPosiciones(txId, json);
		this.lineas = lineas;
		this.lineasExcluidas = lineasExcluidas;
		this.crc = CRC.crear(this.codigoCliente, crc);

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
		let incidenciasCabecera = PreCleaner.clean(txId, this, K.PRE_CLEAN.DEVOLUCIONES.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaDevolucion) => {
				let incidenciasLinea = PreCleaner.clean(txId, lineaDevolucion, K.PRE_CLEAN.DEVOLUCIONES.LINEAS);
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

	obtenerRespuestaCliente(txId, respuestaSap) {

		let respuestaCliente = clone(respuestaSap);
		let incidenciaClienteDesconocido = false;

		respuestaCliente.forEach(devolucion => {

			// Si hemos encontrado una incidencia de cliente desconocido, abortamos buclelele.
			if (incidenciaClienteDesconocido) return;

			// Hacemos un tratamiento especial de las cabeceras que devuelve SAP en buca de incidencias.
			if (devolucion.incidencias && devolucion.incidencias.filter) {

				devolucion.incidencias = devolucion.incidencias.filter((incidenciaCabecera) => {
					// Si aparece la incidencia 'Cliente desconocido', la suprimimos de la respuesta al cliente
					// y al poner incidenciaClienteDesconocido a true. Esto hará que la devolución se marque como rechazada.
					if (incidenciaCabecera && incidenciaCabecera.descripcion === "Cliente desconocido") {
						incidenciaClienteDesconocido = true;
						return false;
					}
					// Si aparece la incidencia 'Devolución duplicada', la suprimimos de la respuesta al cliente y levantamos el flag 'DUPLICADO_SAP'.
					else if (incidenciaCabecera && incidenciaCabecera.descripcion === "Devolución duplicada") {
						L.xi(txId, ['Se encontró la incidencia de "Devolución duplicada" en la respuesta de SAP']);
						iFlags.set(txId, K.FLAGS.DUPLICADO_SAP);
						return false;
					}
					return true;
 
				})
			}

			if (devolucion && devolucion.sap_punto_entrega) {
				iFlags.set(txId, K.FLAGS.PUNTO_ENTREGA, devolucion.sap_punto_entrega);
			}
			devolucion = SaneadorDevolucionesSAP.sanearMayusculas(devolucion);
			devolucion = SaneadorDevolucionesSAP.eliminarCamposInnecesarios(devolucion);
		})

		// Si aparece la incidencia de cliente desconocido en cualquier devolución (debería haber solo 1), enviaremos el mensaje de rechazo y abortamos el resto del saneado
		if (incidenciaClienteDesconocido) {
			L.xw(txId, 'Se encontró la incidencia de "Cliente desconocido" en la respuesta de SAP - Devolución rechazada')
			let errorFedicom = new ErrorFedicom('DEV-ERR-002', 'El parámetro "codigoCliente" es inválido', 400)
			let respuestaClienteError = errorFedicom.getErrors();
			respuestaClienteError.estadoTransmision = () => { return [K.TX_STATUS.RECHAZADO_SAP, [], 400] }
			respuestaClienteError.isRechazadoSap = () => true;
			return respuestaClienteError;
		}


		let estado = K.TX_STATUS.OK;

		// Si se excluyeron lineas, generamos una devolución sin número donde incluimos 
		// las lineas que quedaron excluidas y el motivo
		if (this.lineasExcluidas.length > 0) {
			respuestaCliente.push(this.generarRespuestaExclusiones());
			estado = K.TX_STATUS.DEVOLUCION.PARCIAL
			iFlags.set(txId, K.FLAGS.DEVOLUCION_PARCIAL, true);
		}

		_estableceFlags(txId, respuestaCliente);


		respuestaCliente.estadoTransmision = () => { return _obtenerEstadoDeRespuestaSap(respuestaCliente, estado) }
		respuestaCliente.isRechazadoSap = () => false;
		return respuestaCliente;
	}


}

const _analizarPosiciones = (txId, json) => {
	let lineas = [];
	let lineasExcluidas = [];
	let crc = '';
	let ordenes = [];

	json.lineas.forEach((linea, i) => {
		let nuevaLinea = new LineaDevolucion(linea, txId, i);

		crc = CRC.crear(crc, nuevaLinea.crc);
		delete nuevaLinea.crc;

		if (nuevaLinea.excluir) {
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
	let siguienteOrdinal = 1;
	lineas.forEach((linea) => {
		if (!linea.orden) {
			while (ordenes.includes(siguienteOrdinal)) {
				siguienteOrdinal++;
			}
			linea.orden = siguienteOrdinal;
			siguienteOrdinal++;
		}
	});

	return [lineas, lineasExcluidas, crc];

}


/**
 * Funciones para sanear la respuesta de SAP y obtener la respuesta que se
 * va a dar realmente al cliente.
 */
const SaneadorDevolucionesSAP = {
	sanearMayusculas: (devolucion) => {
		K.POST_CLEAN.DEVOLUCIONES.replaceCab.forEach((nombreCampo) => {
			let nombreCampoMinusculas = nombreCampo.toLowerCase();
			if (devolucion[nombreCampoMinusculas] !== undefined) {
				devolucion[nombreCampo] = devolucion[nombreCampoMinusculas];
				delete devolucion[nombreCampoMinusculas];
			}
		});

		if (devolucion.lineas) {
			devolucion.lineas.forEach((linea) => {
				K.POST_CLEAN.DEVOLUCIONES.replacePos.forEach((nombreCampo) => {
					let nombreCampoMinusculas = nombreCampo.toLowerCase();
					if (linea[nombreCampoMinusculas] !== undefined) {
						linea[nombreCampo] = linea[nombreCampoMinusculas];
						delete linea[nombreCampoMinusculas];
					}
				});
			});
		}
		return devolucion;

	},
	eliminarCamposInnecesarios: (devolucion) => {
		K.POST_CLEAN.DEVOLUCIONES.removeCab.forEach((campo) => {
			delete devolucion[campo];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabEmptyString.forEach((campo) => {
			if (devolucion[campo] === '') delete devolucion[campo];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabEmptyArray.forEach((campo) => {
			if (devolucion[campo] && typeof devolucion[campo].push === 'function' && devolucion[campo].length === 0) delete devolucion[campo];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabZeroValue.forEach((campo) => {
			if (devolucion[campo] === 0) delete devolucion[campo];
		});
		K.POST_CLEAN.DEVOLUCIONES.removeCabIfFalse.forEach((campo) => {
			if (devolucion[campo] === false) delete devolucion[campo];
		});


		/**
		 * Limpieza de incidencias si vienen con algún campo vacío
		 * Por ejemplo, si se manda un CN6+1, SAP responde: {
		 * 		"codigo": "LIN-DEV-WARN-999",
		 * 		"descripcion": ""
		 * }
		 */
		if (devolucion.incidencias && devolucion.incidencias.forEach) {
			let incidenciasSaneadas = []
			devolucion.incidencias.forEach(incidencia => {
				if (incidencia && incidencia.codigo && incidencia.descripcion) {
					incidenciasSaneadas.push(incidencia);
				}
			})
			if (incidenciasSaneadas.length > 0)
				devolucion.incidencias = incidenciasSaneadas;
			else
				delete devolucion.incidencias;
		}


		if (devolucion.lineas && devolucion.lineas.forEach) {
			devolucion.lineas.forEach((linea) => {
				K.POST_CLEAN.DEVOLUCIONES.removePos.forEach((campo) => {
					delete linea[campo];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosEmptyString.forEach((campo) => {
					if (linea[campo] === '') delete linea[campo];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosEmptyArray.forEach((campo) => {
					if (linea[campo] && typeof linea[campo].push === 'function' && linea[campo].length === 0) delete linea[campo];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosZeroValue.forEach((campo) => {
					if (linea[campo] === 0) delete linea[campo];
				});
				K.POST_CLEAN.DEVOLUCIONES.removePosIfFalse.forEach((campo) => {
					if (linea[campo] === false) delete linea[campo];
				});

				/**
				 * Limpieza de incidencias si vienen con algún campo vacío
				 * Por ejemplo, si se manda un CN6+1, SAP responde: {
				 * 		"codigo": "LIN-DEV-WARN-999",
				 * 		"descripcion": ""
				 * }
				 */
				if (linea.incidencias && linea.incidencias.forEach) {
					let incidenciasSaneadas = []
					linea.incidencias.forEach(incidencia => {
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
		return devolucion;
	}
}


const _obtenerEstadoDeRespuestaSap = (sapBody, estado) => {

	let estadoTransmision = estado || K.TX_STATUS.OK;
	let codigoHttpRespuesta = estadoTransmision === K.TX_STATUS.OK ? 201 : 206;

	let numerosDevolucion = [];
	if (sapBody && sapBody.length > 0) {
		sapBody.forEach((devolucion) => {
			if (devolucion && devolucion.numeroDevolucion) {
				numerosDevolucion.push(devolucion.numeroDevolucion);
			}
		});
	}

	return [estadoTransmision, numerosDevolucion, codigoHttpRespuesta];
}


/**
 * Analiza la respuesta de la devolucion y establece las flags que se apliquen en función del contenido de la misma.
 * 
 * @param {*} txId Id de transmisión sobre el que se aplicarán las flags
 * @param {*} respuestaDevoluciones 
 */
const _estableceFlags = (txId, respuestaDevoluciones) => {

	if (respuestaDevoluciones && respuestaDevoluciones.forEach) {

		let generaCodigoRecogida = false;

		// Aclaraciones:
		/**
		 * Para el cálculo de: lineas, cantidad, lineasEstupe y cantidadEstupe se tienen en cuenta todas las líneas transmitidas,
		 * independientemente de si la línea se excluye, tiene incidencias o lo que sea.
		 * Para el cálculo de líneas/cantidades con incidencias, solo se tienen en cuenta aquellas líneas que NO fueron excluidas.
		 */
		let totales = {
			lineas: 0,
			lineasExcluidas: 0,
			lineasIncidencias: 0,
			lineasEstupe: 0,
			cantidad: 0,
			cantidadExcluida: 0,
			cantidadIncidencias: 0,
			cantidadEstupe: 0,
			devoluciones: 0
		}

		respuestaDevoluciones.forEach(devolucion => {

			if (devolucion && devolucion.lineas && devolucion.lineas.forEach) {

				if (devolucion.numeroDevolucion) totales.devoluciones++;
				if (devolucion.codigoRecogida) generaCodigoRecogida = true;

				devolucion.lineas.forEach(linea => {
					totales.lineas++;
					if (linea.cantidad) totales.cantidad += linea.cantidad;

					if (linea.valeEstupefaciente) {
						totales.lineasEstupe++;
						if (linea.cantidad) totales.cantidadEstupe += linea.cantidad;
					}

					// Si está en una devolución con numeroDevolucion, es que la devolución no ha sido excluida
					// en este caso, miraremos si la linea tiene incidencias para contarlas
					if (devolucion.numeroDevolucion) {
						if (linea.incidencias && linea.incidencias.length) {
							totales.lineasIncidencias++;
							if (linea.cantidad) totales.cantidadIncidencias += linea.cantidad
						}
						// Si está en una devolución SIN numeroDevolucion, es que la línea ha sido excluida
						// en este caso aumentamos el contador de lineas/cantidades excluidas
					} else {
						totales.lineasExcluidas++;
						if (linea.cantidad) totales.cantidadExcluida += linea.cantidad;
					}

				});
			}
		});

		if (totales.lineasEstupe) iFlags.set(txId, K.FLAGS.ESTUPEFACIENTE)
		if (generaCodigoRecogida) iFlags.set(txId, K.FLAGS.GENERA_RECOGIDA);
		iFlags.set(txId, K.FLAGS.TOTALES, totales);



	} else {
		iFlags.set(txId, K.FLAGS.TOTALES, { lineas: 0 });
	}

}



module.exports = Devolucion;
