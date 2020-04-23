'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const clone = require('clone');
const HOSTNAME = require('os').hostname();

// Interfaces
const iFlags = require('interfaces/iFlags')

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');
const LineaPedido = require('./ModeloLineaPedido');
const CRC = require('model/CRC');

// Helpers
const PreCleaner = require('transmutes/preCleaner');
const FieldChecker = require('util/fieldChecker');


class Pedido {

	constructor(req) {

		let txId = req.txId;
		let json = req.body;

		// SANEADO OBLIGATORIO
		let errorFedicom = new ErrorFedicom();
		FieldChecker.checkNotEmptyString(json.codigoCliente, errorFedicom, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, errorFedicom, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
		FieldChecker.checkNotEmptyString(json.numeroPedidoOrigen, errorFedicom, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')

		if (json.codigoCliente && json.codigoCliente.endsWith('@hefame')) {
			errorFedicom.add('PED-ERR-002', 'Indique el "codigoCliente" si el @hefame al final', 400);
		}

		if (errorFedicom.hasError()) {
			L.xe(txId, ['El pedido contiene errores. Se aborta el procesamiento del mismo', errorFedicom]);
			throw errorFedicom;
		}

		// SANEADO OBLIGATORIO DE LINEAS
		let [lineas, sap_ignore_all] = _analizarPosiciones(txId, json);
		// Si todas las lineas serán ignoradas, no hay pedido
		if (sap_ignore_all) {
			L.xe(txId, ['El pedido contiene errores en todas las líneas. Se aborta el procesamiento del mismo']);
			throw new ErrorFedicom(K.CODIGOS_ERROR_FEDICOM.ERR_TODAS_LINEAS_ERROR, 'Existen errores en todas las líneas, el pedido no se procesa.', 400);
		}

		// COPIA DE PROPIEDADES
		Object.assign(this, json);
		this.lineas = lineas;

		// LIMPIEZA DEL CODIGO DE CLIENTE
		// Si tiene mas de 10 dígitos, SAP da error 500 por lo que lo limpiamos
		if (this.codigoCliente.length > 10) {
			let codigoClienteNuevo = this.codigoCliente.substring(this.codigoCliente.length - 10);
			L.xw(txId, ['Se trunca el codigo de cliente a 10 dígitos para que SAP no explote', this.codigoCliente, codigoClienteNuevo]);
			this.codigoCliente = codigoClienteNuevo;
		}


		// INFORMACION DE LOGIN INCLUIDA EN EL PEDIDO
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		// GENERACION DE CRC
		this.generarCRC();
		L.xd(txId, ['Se asigna el siguiente CRC para el pedido', this.crc], 'txCRC')

		// INCLUYE LA URL DE CONFIRMACION PARA SAP
		this.sap_url_confirmacion = _generaUrlConfirmacion();

		// ARREGLO DEL CODIGO DEL ALMACEN
		let [codigoAlmacenServicioConvertido, errorAlmacen] = _converAlmacen(this.codigoAlmacenServicio);
		delete this.codigoAlmacenServicio;
		if (codigoAlmacenServicioConvertido) this.codigoAlmacenServicio = codigoAlmacenServicioConvertido;
		if (errorAlmacen) this.addIncidencia(errorAlmacen)
	}

	generarCRC() {
		this.crc = CRC.crear(this.codigoCliente, this.numeroPedidoOrigen);
	}

	simulaFaltas() {
		let errorFedicom = { codigo: 'PED-WARN-001', descripcion: 'Pedido recibido pero pendiente de tramitar - Consulte o reintente más tarde para obtener toda la información' };
		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push(errorFedicom);
		} else {
			this.incidencias = [errorFedicom];
		}
		this.fechaPedido = Date.toFedicomDateTime();
		this.numeroPedido = this.crc;
		delete this.sap_url_confirmacion;
		delete this.crc;
		delete this.login;
		delete this.sapSystem;
	}

	limpiarEntrada(txId) {

		// LIMPIEZA DE LOS CAMPOS DE CABECERA
		let incidenciasCabecera = PreCleaner.clean(txId, this, K.PRE_CLEAN.PEDIDOS.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaPedido) => {
				let incidenciasLinea = PreCleaner.clean(txId, lineaPedido, K.PRE_CLEAN.PEDIDOS.LINEAS);
				if (incidenciasLinea.hasError()) {
					if (lineaPedido.incidencias && lineaPedido.incidencias.concat) {
						lineaPedido.incidencias.concat(incidenciasLinea.getErrors());
					} else {
						lineaPedido.incidencias = incidenciasLinea.getErrors();
					}
				}
			});
		}

	}

	/**
	 * Añade una incidencia a la cabecera del pedido.
	 * Se puede indicar el (codigo, descripcion) del error, o pasar un único parametro con un objeto instancia de ErrorFedicom
	 * @param {*} code 
	 * @param {*} descripcion 
	 */
	addIncidencia(code, descripcion) {
		let incidencia = (code instanceof ErrorFedicom) ? code : new ErrorFedicom(code, descripcion);

		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push(incidencia.getErrors()[0])
		} else {
			this.incidencias = incidencia.getErrors();
		}
	}

	obtenerRespuestaCliente(txId, respuestaSAP) {

		let respuestaCliente = clone(respuestaSAP);

		// Si la respuesta de SAP es un array, no hay que sanearlo
		if (Array.isArray(respuestaCliente)) {
			respuestaCliente = SaneadorPedidosSAP.eliminaIncidenciasDeBloqueos(respuestaCliente);
			respuestaCliente.estadoTransmision = () => { return [K.TX_STATUS.RECHAZADO_SAP, null, null] }
			respuestaCliente.isRechazadoSap = () => true;
			return respuestaCliente;
		}

		// Si la respuesta lleva el valor del punto de entrega del cliente, generamos flag
		if (respuestaCliente && respuestaCliente.sap_punto_entrega) {
			iFlags.set(txId, K.FLAGS.PUNTO_ENTREGA, respuestaCliente.sap_punto_entrega);
		}

		respuestaCliente = SaneadorPedidosSAP.sanearMayusculas(respuestaCliente);
		respuestaCliente = SaneadorPedidosSAP.establecerNumeroPedido(respuestaCliente, this.crc);
		respuestaCliente = SaneadorPedidosSAP.establecerFechaPedido(respuestaCliente);
		respuestaCliente = SaneadorPedidosSAP.eliminarCamposInnecesarios(respuestaCliente);
		respuestaCliente = SaneadorPedidosSAP.eliminarInicidenciaPedidoDuplicado(txId, respuestaCliente);

		respuestaCliente.estadoTransmision = () => { return _obtenerEstadoDeRespuestaSap(respuestaSAP) }
		respuestaCliente.isRechazadoSap = () => false;

		// Establecemos FLAGS
		_estableceFlags(txId, respuestaCliente);

		return respuestaCliente;
	}

	static extraerPedidosAsociados(listaPedidosAsociadosSap) {
		return SaneadorPedidosSAP.extraerPedidosAsociados(listaPedidosAsociadosSap);
	}

}



const _analizarPosiciones = (txId, json) => {
	let lineas = [];
	let ordenes = [];

	let sap_ignore_all = true;

	json.lineas.forEach((linea) => {
		let lineaPedido = new LineaPedido(txId, linea);
		lineas.push(lineaPedido);

		// Guardamos el orden de aquellas lineas que lo llevan para no duplicarlo
		if (lineaPedido.orden) {
			ordenes.push(parseInt(lineaPedido.orden));
		}

		if (!lineaPedido.sap_ignore) {
			sap_ignore_all = false;
		}
	});

	// Rellenamos el orden.
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
	return [lineas, sap_ignore_all];

}

const _converAlmacen = (codigoAlmacen) => {
	if (!codigoAlmacen || !codigoAlmacen.trim) return [null, null];

	codigoAlmacen = codigoAlmacen.trim();
	if (!codigoAlmacen.startsWith('RG')) {
		let codigoFedicom2 = parseInt(codigoAlmacen);
		switch (codigoFedicom2) {
			case 2: return ['RG01', null];  // Santomera
			case 5: return ['RG15', null]; // Barcelona viejo
			case 9: return ['RG19', null]; // Málaga viejo
			case 13: return ['RG04', null]; // Madrid viejo
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
				return ['RG' + (codigoFedicom2 > 9 ? codigoFedicom2 : '0' + codigoFedicom2), null];
			default:
				return [null, new ErrorFedicom(K.CODIGOS_ERROR_FEDICOM.WARN_NO_EXISTE_ALMACEN, 'No se reconoce el código de almacén indicado – Se le asigna su almacén habitual')]
		}
	} else {
		return [codigoAlmacen, null];
	}
}

const _generaUrlConfirmacion = () => {
	return 'http://' + HOSTNAME + '.hefame.es:' + C.http.port + '/confirmaPedido';
}

/**
 * Funciones para sanear la respuesta de SAP y obtener la respuesta que se
 * va a dar realmente al cliente.
 */
const SaneadorPedidosSAP = {
	eliminaIncidenciasDeBloqueos: (respuestaCliente) => {

		let cantidadIncidenciasAntes = respuestaCliente.length;

		respuestaCliente = respuestaCliente.filter((incidencia) => {
			return (incidencia && incidencia.codigo && !incidencia.codigo.startsWith('SAP-IGN'));
		});

		// Si el número de incidencias varía, es que había incidencias SAP-IGN que han sido eliminadas,
		// por tanto, agregamos la incidencia de error de bloqueo en SAP.
		if (cantidadIncidenciasAntes !== respuestaCliente.length) {
			let errorClienteBloqueadoSap = new ErrorFedicom(K.CODIGOS_ERROR_FEDICOM.ERR_BLOQUEO_SAP, 'No se pudo guardar el pedido. Contacte con su comercial.');
			respuestaCliente = respuestaCliente.concat(errorClienteBloqueadoSap.getErrors());
		}

		return respuestaCliente;
	},
	sanearMayusculas: (respuestaCliente) => {
		K.POST_CLEAN.PEDIDOS.replaceCab.forEach((atributo) => {
			let atributoMinusculas = atributo.toLowerCase();
			if (respuestaCliente[atributoMinusculas] !== undefined) {
				respuestaCliente[atributo] = respuestaCliente[atributoMinusculas];
				delete respuestaCliente[atributoMinusculas];
			}
		});

		if (respuestaCliente.lineas) {
			respuestaCliente.lineas.forEach((linea) => {
				K.POST_CLEAN.PEDIDOS.replacePos.forEach((atributo) => {
					let atributoMinusculas = atributo.toLowerCase();
					if (linea[atributoMinusculas] !== undefined) {
						linea[atributo] = linea[atributoMinusculas];
						delete linea[atributoMinusculas];
					}
				});
			});
		}
		return respuestaCliente;
	},
	eliminarCamposInnecesarios: (respuestaCliente) => {

		K.POST_CLEAN.PEDIDOS.removeCab.forEach((atributo) => {
			delete respuestaCliente[atributo];
		});
		K.POST_CLEAN.PEDIDOS.removeCabEmptyString.forEach((atributo) => {
			if (respuestaCliente[atributo] === '') delete respuestaCliente[atributo];
		});
		K.POST_CLEAN.PEDIDOS.removeCabEmptyArray.forEach((atributo) => {
			if (respuestaCliente[atributo] && typeof respuestaCliente[atributo].push === 'function' && respuestaCliente[atributo].length === 0) delete respuestaCliente[atributo];
		});
		K.POST_CLEAN.PEDIDOS.removeCabZeroValue.forEach((atributo) => {
			if (respuestaCliente[atributo] === 0) delete respuestaCliente[atributo];
		});
		K.POST_CLEAN.PEDIDOS.removeCabIfFalse.forEach((atributo) => {
			if (respuestaCliente[atributo] === false) delete respuestaCliente[atributo];
		});

		if (respuestaCliente.lineas) {
			respuestaCliente.lineas.forEach((linea) => {
				K.POST_CLEAN.PEDIDOS.removePos.forEach((atributo) => {
					delete linea[atributo];
				});
				K.POST_CLEAN.PEDIDOS.removePosEmptyString.forEach((atributo) => {
					if (linea[atributo] === '') delete linea[atributo];
				});
				K.POST_CLEAN.PEDIDOS.removePosEmptyArray.forEach((atributo) => {
					if (linea[atributo] && typeof linea[atributo].push === 'function' && linea[atributo].length === 0) delete linea[atributo];
				});
				K.POST_CLEAN.PEDIDOS.removePosZeroValue.forEach((atributo) => {
					if (linea[atributo] === 0) delete linea[atributo];
				});
				K.POST_CLEAN.PEDIDOS.removePosIfFalse.forEach((atributo) => {
					if (linea[atributo] === false) delete linea[atributo];
				});

				if (linea.servicioDemorado) {
					if (!linea.cantidadFalta)
						linea.estadoServicio = 'SC';
					else
						linea.estadoServicio = 'SR';
				}

			});
		}
		return respuestaCliente;
	},
	establecerNumeroPedido: (respuestaCliente, crc) => {
		respuestaCliente.numeroPedido = crc;
		return respuestaCliente;
	},
	establecerFechaPedido: (respuestaCliente) => {
		if (!respuestaCliente.fechaPedido)
			respuestaCliente.fechaPedido = Date.toFedicomDateTime();
		return respuestaCliente;
	},
	extraerPedidosAsociados: (pedidosAsociados) => {
		if (!pedidosAsociados) return null;
		if (!pedidosAsociados.forEach) return [pedidosAsociados];
		// Eliminamos valores vacíos de la lista (SAP a veces mete un string vacío en el array)
		pedidosAsociados = pedidosAsociados.filter( numeroPedidoSap => numeroPedidoSap ? true : false);
		if (pedidosAsociados.length > 0) return pedidosAsociados;
		return null;
	},
	/**
	 * Elimina en las indidencias de cabecera una que sea exactamente {codigo: "", "descripcion": "Pedido duplicado"}
	 * y activa el flag K.FLAGS.DUPLICADO_SAP si la encuentra
	 */
	eliminarInicidenciaPedidoDuplicado: (txId, respuestaSAP) => {
		if (respuestaSAP.incidencias && respuestaSAP.incidencias.forEach) {
			let incidenciasSaneadas = [];
			respuestaSAP.incidencias.forEach(incidencia => {
				if (incidencia) {
					if (incidencia.codigo && incidencia.descripcion) {
						incidenciasSaneadas.push(incidencia);
					} else if (!incidencia.codigo && incidencia.descripcion === 'Pedido duplicado') {
						iFlags.set(txId, K.FLAGS.DUPLICADO_SAP, true);
					}
				}
			});
			respuestaSAP.incidencias = incidenciasSaneadas;
		}
		return respuestaSAP;
	}
}


const _obtenerEstadoDeRespuestaSap = (respuestaSap) => {

	let estadoTransmision = K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO;
	let numeroPedidoAgrupado = (respuestaSap.numeropedido) ? respuestaSap.numeropedido : null;
	let numerosPedidoSAP = SaneadorPedidosSAP.extraerPedidosAsociados(respuestaSap.sap_pedidosasociados);

	// Si es un pedido inmediato, SAP debe haber devuelto los numeros de pedido asociados si o si
	if (respuestaSap.sap_pedidoprocesado) {
		estadoTransmision = K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		if (numerosPedidoSAP) {
			estadoTransmision = K.TX_STATUS.OK;
		}
	}
	return [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP || []];
}

/**
 * Analiza la respuesta del pedido y establece las flags que se apliquen en función del contenido de la misma.
 * 
 * @param {*} txId Id de transmisión sobre el que se aplicarán las flags
 * @param {*} respuestaPedido 
 */
const _estableceFlags = (txId, respuestaPedido) => {

	if (respuestaPedido && respuestaPedido.lineas && respuestaPedido.lineas.forEach) {

		let totales = {
			lineas: 0,
			lineasIncidencias: 0,
			lineasDemorado: 0,
			lineasEstupe: 0,
			cantidad: 0,
			cantidadBonificacion: 0,
			cantidadFalta: 0,
			cantidadBonificacionFalta: 0,
			cantidadEstupe: 0,
		}

		respuestaPedido.lineas.forEach(linea => {
			let tipificacionMotivosFalta = _analizaMotivosFalta(linea.incidencias);

			totales.lineas++;
			if (linea.incidencias && linea.incidencias.length) totales.lineasIncidencias++;
			if (linea.servicioDemorado) totales.lineasDemorado++;
			if (linea.cantidad) totales.cantidad += linea.cantidad;
			if (linea.cantidadBonificacion) totales.cantidadBonificacion += linea.cantidadBonificacion;
			if (linea.cantidadFalta) totales.cantidadFalta += linea.cantidadFalta;
			if (linea.cantidadBonificacionFalta) totales.cantidadBonificacionFalta += linea.cantidadBonificacionFalta;
			if (linea.valeEstupefaciente || tipificacionMotivosFalta.estupe) {
				totales.lineasEstupe++;
				totales.cantidadEstupe += linea.cantidad;
			}

		});

		if (totales.cantidad === totales.cantidadFalta) iFlags.set(txId, K.FLAGS.FALTATOTAL)
		if (totales.lineasDemorado) iFlags.set(txId, K.FLAGS.DEMORADO)
		if (totales.cantidadBonificacion) iFlags.set(txId, K.FLAGS.BONIFICADO)
		if (totales.lineasEstupe) iFlags.set(txId, K.FLAGS.ESTUPEFACIENTE)

		iFlags.set(txId, K.FLAGS.TOTALES, totales);


		// El Flag tipoPedido contiene el tipo del pedido saneado para permitir búsquedas por tipo de pedido rápidas y fiables.
		// Si tipoPedido es una clave de transmisión típica de fedicom (un número de 0 a 999999) se guarda el valor numérico. 
		// Si no se indica nada, por defecto se usa un 0.
		// Si el valor no es numérico (se indica grupo de precios SAP p.e. "KF"), no se guarda lo que hará que las búsquedas de este código sean 
		// mortales ya que el campo tipoPedido no está indexado en mongo, ya que mete mucha mierda 
		// (p.e: no reconocería que "1", "001", "000001", "001   " son el mismo valor)
		if (respuestaPedido.tipoPedido) {
			let tipoInt = parseInt(respuestaPedido.tipoPedido);
			if (tipoInt >= 0 && tipoInt <= 999999) {
				iFlags.set(txId, K.FLAGS.TIPO, tipoInt);
			}
		} else {
			// Si no hay tipoPedido, se pone un cerapio a capón
			iFlags.set(txId, K.FLAGS.TIPO, 0);
		}

	} else {
		iFlags.set(txId, K.FLAGS.TOTALES, { lineas: 0 });
	}

}

/**
 * Analiza burdamente los mensajes de faltas de lineas para clasificar las faltas en 
 * grupos generalizados (estupe|stock|noPermitido|suministro|desconocido)
 * @param {*} incidencias 
 */
const _analizaMotivosFalta = (incidencias) => {
	if (!incidencias || !incidencias.forEach) return {}

	let tipos = {};
	incidencias.forEach(incidencia => {
		if (incidencia.descripcion) {
			let tipoFalta = K.TIPIFICADO_FALTAS[incidencia.descripcion];
			if (tipoFalta) tipos[tipoFalta] = true;
		}
	})
	return tipos;
}

module.exports = Pedido;
