'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');
const LineaPedido = require(BASE + 'model/pedido/ModeloLineaPedido');

const PreCleaner = require(BASE + 'transmutes/preCleaner');
const FieldChecker = require(BASE + 'util/fieldChecker');
const iFlags = require(BASE + 'interfaces/iFlags')
const CRC = require(BASE + 'model/CRC');

const clone = require('clone');
const HOSTNAME = require('os').hostname();



class Pedido {

	constructor(req) {

		var json = req.body;

		// SANEADO OBLIGATORIO
		var fedicomError = new FedicomError();
		FieldChecker.checkNotEmptyString(json.codigoCliente, fedicomError, 'PED-ERR-002', 'El campo "codigoCliente" es obligatorio');
		FieldChecker.checkExistsAndNonEmptyArray(json.lineas, fedicomError, 'PED-ERR-004', 'El campo "lineas" no puede estar vacío');
		FieldChecker.checkNotEmptyString(json.numeroPedidoOrigen, fedicomError, 'PED-ERR-006', 'El campo "numeroPedidoOrigen" es obligatorio')

		if (json.codigoCliente && json.codigoCliente.endsWith('@hefame')) {
			fedicomError.add('PED-ERR-002', 'Indique el "codigoCliente" si el @hefame al final', 400);
		}

		if (fedicomError.hasError()) {
			L.xe(req.txId, ['El pedido contiene errores. Se aborta el procesamiento del mismo', fedicomError]);
			throw fedicomError;
		}

		// SANEADO OBLIGATORIO DE LINEAS
		var [lineas, sap_ignore_all] = parseLines(json, req.txId);
		// Si todas las lineas serán ignoradas, no hay pedido
		if (sap_ignore_all) {
			L.xe(req.txId, ['El pedido contiene errores en todas las líneas. Se aborta el procesamiento del mismo']);
			throw new FedicomError(K.CODIGOS_ERROR_FEDICOM.ERR_TODAS_LINEAS_ERROR, 'Existen errores en todas las líneas, el pedido no se procesa.', 400);
		}

		// COPIA DE PROPIEDADES
		Object.assign(this, json);
		this.lineas = lineas;

		// LIMPIEZA DEL CODIGO DE CLIENTE
		// Si tiene mas de 10 dígitos, SAP da error 500 por lo que lo limpiamos
		if (this.codigoCliente.length > 10) {
			var codigoClienteNuevo = this.codigoCliente.substring(this.codigoCliente.length - 10);
			L.xw(req.txId, ['Se arregla el codigo de cliente', this.codigoCliente, codigoClienteNuevo]);
			this.codigoCliente = codigoClienteNuevo;
		}


		// INFORMACION DE LOGIN INCLUIDA EN EL PEDIDO
		this.login = {
			username: req.token.sub,
			domain: req.token.aud
		}

		// GENERACION DE CRC
		this.generarCRC();
		L.xd(req.txId, ['Se asigna el siguiente CRC para el pedido', this.crc], 'txCRC')

		// INCLUYE LA URL DE CONFIRMACION PARA SAP
		this.sap_url_confirmacion = generaUrlConfirmacion();

		// ARREGLO DEL CODIGO DEL ALMACEN
		var [codigoAlmacenServicioConvertido, errorAlmacen] = converAlmacen(this.codigoAlmacenServicio);
		delete this.codigoAlmacenServicio;
		if (codigoAlmacenServicioConvertido) this.codigoAlmacenServicio = codigoAlmacenServicioConvertido;
		if (errorAlmacen) this.addIncidencia(errorAlmacen)
	}

	generarCRC() {
		this.crc = CRC.crear(this.codigoCliente, this.numeroPedidoOrigen);
	}

	simulaFaltas() {
		var fedicomError = { codigo: 'PED-WARN-001', descripcion: 'Pedido recibido pero pendiente de tramitar - Consulte o reintente más tarde para obtener toda la información'};
		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push( fedicomError );
		} else {
			this.incidencias = [fedicomError];
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
		var incidenciasCabecera = PreCleaner.clean(txId, this, K.PRE_CLEAN.PEDIDOS.CABECERA);
		if (this.incidencias && this.incidencias.concat) {
			this.incidencias.concat(incidenciasCabecera.getErrors());
		} else {
			this.incidencias = incidenciasCabecera.getErrors();
		}

		// LIMPIEZA DE LAS LINEAS
		if (this.lineas && this.lineas.forEach) {
			this.lineas.forEach((lineaPedido) => {
				var incidenciasLinea = PreCleaner.clean(txId, lineaPedido, K.PRE_CLEAN.PEDIDOS.LINEAS);
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

	addIncidencia(code, descripcion) {
		var incidencia = (code instanceof FedicomError) ? code : new FedicomError(code, descripcion);

		if (this.incidencias && this.incidencias.push) {
			this.incidencias.push( incidencia.getErrors()[0] )
		} else {
			this.incidencias = incidencia.getErrors();
		}
	}

	obtenerRespuestaCliente( txId, respuestaSAP ) {
		
		var clon = clone(respuestaSAP);

		// Si la respuesta de SAP es un array, no hay que sanearlo
		if (Array.isArray(clon)) {
			clon = SaneadorPedidosSAP.eliminaIncidenciasDeBloqueos(clon);
			clon.estadoTransmision = () => { return [K.TX_STATUS.RECHAZADO_SAP, null, null] }
			clon.isRechazadoSap = () => true;
			return clon;
		}

		// Si la respuesta lleva el valor del punto de entrega del cliente, generamos flag
		if (clon && clon.sap_punto_entrega) {
			iFlags.set(txId, K.FLAGS.PUNTO_ENTREGA, clon.sap_punto_entrega);
		}

		clon = SaneadorPedidosSAP.sanearMayusculas(clon);
		clon = SaneadorPedidosSAP.establecerNumeroPedido(clon, this.crc);
		clon = SaneadorPedidosSAP.establecerFechaPedido(clon);
		clon = SaneadorPedidosSAP.eliminarCamposInnecesarios(clon);
		
		clon.estadoTransmision = () => { return obtenerEstadoDeRespuestaSap(respuestaSAP) }
		clon.isRechazadoSap = () => false;

		// Establecemos FLAGS
		estableceFlags(txId, clon);
		



		return clon;
	}

	static extraerPedidosAsociados(sapBody) {
		return SaneadorPedidosSAP.extraerPedidosAsociados(sapBody);
	}

}



const parseLines = (json, txId) => {
	var lineas = [];
	var ordenes = [];
	function rellena(lineas) {

		var sap_ignore_all = true;

		json.lineas.forEach(function (linea) {
			var lineaPedido = new LineaPedido(linea, txId);
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
		return [lineas, sap_ignore_all];
	}
	return rellena(lineas);
}

const converAlmacen = (codigoAlmacen) => {
	if (!codigoAlmacen || !codigoAlmacen.trim) return [null, null];

	codigoAlmacen = codigoAlmacen.trim();
	if (!codigoAlmacen.startsWith('RG')) {
		var codigoFedicom2 = parseInt(codigoAlmacen);
		switch (codigoFedicom2) {
			case 2:  return ['RG01', null];  // Santomera
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
				return [null, new FedicomError(K.CODIGOS_ERROR_FEDICOM.WARN_NO_EXISTE_ALMACEN, 'No se reconoce el código de almacén indicado – Se le asigna su almacén habitual')]
		}
	} else {
		return [codigoAlmacen, null];
	}
}

const generaUrlConfirmacion = () => {
	return 'http://' + HOSTNAME + '.hefame.es:' + C.http.port + '/confirmaPedido';
}

/**
 * Funciones para sanear la respuesta de SAP y obtener la respuesta que se
 * va a dar realmente al cliente.
 */
const SaneadorPedidosSAP = {
	eliminaIncidenciasDeBloqueos: (message) => {
		var cantidadIncidenciasAntes = message.length;
		
		message = message.filter((item) => {
			return !item || !item.codigo || !item.codigo.startsWith('SAP-IGN');
		});

		// Si el número de incidencias varía, es que había incidencias a eliminar
		if (cantidadIncidenciasAntes !== message.length) {
			var errorBloqueo = new FedicomError(K.CODIGOS_ERROR_FEDICOM.ERR_BLOQUEO_SAP, 'No se pudo guardar el pedido. Contacte con su comercial.');
			message = message.concat(errorBloqueo.getErrors());
		}

		return message;
	},
	sanearMayusculas: (message) => {
		K.POST_CLEAN.PEDIDOS.replaceCab.forEach((field) => {
			var fieldLowerCase = field.toLowerCase();
			if (message[fieldLowerCase] !== undefined) {
				message[field] = message[fieldLowerCase];
				delete message[fieldLowerCase];
			}
		});

		if (message.lineas) {
			message.lineas.forEach(function (linea) {
				K.POST_CLEAN.PEDIDOS.replacePos.forEach(function (field) {
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

		K.POST_CLEAN.PEDIDOS.removeCab.forEach(function (field) {
			delete message[field];
		});
		K.POST_CLEAN.PEDIDOS.removeCabEmptyString.forEach(function (field) {
			if (message[field] === '') delete message[field];
		});
		K.POST_CLEAN.PEDIDOS.removeCabEmptyArray.forEach(function (field) {
			if (message[field] && typeof message[field].push === 'function' && message[field].length === 0) delete message[field];
		});
		K.POST_CLEAN.PEDIDOS.removeCabZeroValue.forEach(function (field) {
			if (message[field] === 0) delete message[field];
		});

		K.POST_CLEAN.PEDIDOS.removeCabIfFalse.forEach(function (field) {
			if (message[field] === false) delete message[field];
		});

		if (message.lineas) {
			message.lineas.forEach(function (linea) {
				K.POST_CLEAN.PEDIDOS.removePos.forEach(function (field) {
					delete linea[field];
				});
				K.POST_CLEAN.PEDIDOS.removePosEmptyString.forEach(function (field) {
					if (linea[field] === '') delete linea[field];
				});
				K.POST_CLEAN.PEDIDOS.removePosEmptyArray.forEach(function (field) {
					if (linea[field] && typeof linea[field].push === 'function' && linea[field].length === 0) delete linea[field];
				});
				K.POST_CLEAN.PEDIDOS.removePosZeroValue.forEach(function (field) {
					if (linea[field] === 0) delete linea[field];
				});
				K.POST_CLEAN.PEDIDOS.removePosIfFalse.forEach(function (field) {
					if (linea[field] === false) delete linea[field];
				});

				if (linea.servicioDemorado) {
					if (!linea.cantidadFalta)
						linea.estadoServicio = 'SC';
					else
						linea.estadoServicio = 'SR';
				}

			});
		}
		return message;
	},
	establecerNumeroPedido:  (message, numeroPedidoOriginal) => {
		message.numeroPedido = numeroPedidoOriginal;
		return message;
	},
	establecerFechaPedido: (message) => {
		if (!message.fechaPedido)
			message.fechaPedido = Date.toFedicomDateTime();
		return message;
	},
	extraerPedidosAsociados: (pedidosAsociados) => {
		if (!pedidosAsociados) return null;
		if (!pedidosAsociados.forEach) return [pedidosAsociados];
		var result = [];
		pedidosAsociados.forEach((nPed) => {
			if (nPed) result.push(nPed);
		});
		if (result.length > 0) return result;
		return null;
	}
}


const obtenerEstadoDeRespuestaSap = (sapBody) => {

	var estadoTransmision = K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO;
	var numeroPedidoAgrupado = (sapBody.numeropedido) ? sapBody.numeropedido : null;
	var numerosPedidoSAP = SaneadorPedidosSAP.extraerPedidosAsociados(sapBody.sap_pedidosasociados);

	// Si es un pedido inmediato, SAP debe haber devuelto los numeros de pedido asociados si o si
	if (sapBody.sap_pedidoprocesado) {
		estadoTransmision = K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP;
		if (numerosPedidoSAP) {
			estadoTransmision = K.TX_STATUS.OK;
		}
	}  
	return [ estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP || [] ];
}

const estableceFlags = (txId, clon) => {

	if (clon && clon.lineas && clon.lineas.forEach) {

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

		clon.lineas.forEach(linea => {
			let tipificacionMotivosFalta = analizaMotivosFalta(linea.incidencias);

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

		if (clon.tipoPedido) {
			let tipoInt = parseInt(clon.tipoPedido)
			if (tipoInt >= 0 && tipoInt <= 999999) {
				iFlags.set(txId, K.FLAGS.TIPO, tipoInt);
			}
		} else {
			iFlags.set(txId, K.FLAGS.TIPO, 0);
		}

	} else {
		iFlags.set(txId, K.FLAGS.TOTALES, { lineas: 0 });
	}
	
}

const analizaMotivosFalta  = (incidencias) => {
	if (!incidencias || ! incidencias.forEach ) return {}

	let tipos = {};
	incidencias.forEach( incidencia => {
		if (incidencia.descripcion) {
			let tipoFalta = K.TIPIFICADO_FALTAS[incidencia.descripcion];
			if (tipoFalta) tipos[tipoFalta] = true;
		}
	} )
	return tipos;
}

module.exports = Pedido;
