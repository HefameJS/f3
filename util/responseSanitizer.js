'use strict';
const BASE = global.BASE;
const FedicomError = require(BASE + 'model/fedicomError');
const _ = require('underscore');

const removeCab = [ 'login', 'crc', 'sap_pedidosasociados', 'sap_url_confirmacion', 'sap_pedidoprocesado' ];
const removePos = [ 'posicion_sap', 'valeestupefacientes', 'sap_ignore' ];

const replaceCab = [ 'numeroPedido', 'codigoCliente', 'direccionEnvio', 'numeroPedidoOrigen', 'tipoPedido', 'codigoAlmacenServicio', 'fechaPedido', 'fechaServicio', 'cargoCooperativo', 'empresaFacturadora' ];
const replacePos = [ 'codigoArticulo', 'codigoUbicacion', 'codigoArticuloSustituyente', 'cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte', 'valeEstupefaciente', 'fechaLimiteServicio', 'servicioDemorado', 'estadoServicio', 'servicioAplazado', 'descripcionArticulo', 'codigoAlmacenServicio' ];

const removeCabEmptyString = [ 'condicion', 'observaciones', 'direccionEnvio', 'empresaFacturadora', 'tipoPedido', 'fechaServicio' ];
const removeCabEmptyArray = [ 'notificaciones', 'incidencias', 'alertas' ];
const removeCabZeroValue = [ 'aplazamiento' ];
const removeCabIfFalse = [ 'cargoCooperativo' ];

const removePosEmptyString = [ 'codigoUbicacion', 'codigoArticuloSustituyente', 'valeEstupefaciente', 'fechaLimiteServicio', 'estadoServicio', 'servicioAplazado', 'observaciones' ];
const removePosEmptyArray = [ 'notificaciones', 'incidencias', 'alertas' ];
const removePosZeroValue = [ 'cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte', 'precio' ];
const removePosIfFalse = [ 'servicioDemorado' ];




var sanearMayusculas = function(message) {
	replaceCab.forEach( function (field) {
		var fieldLowerCase = field.toLowerCase();
		if (message[fieldLowerCase] !== undefined) {
			message[field] = message[fieldLowerCase];
			delete message[fieldLowerCase];
		}
	});

	if (message.lineas) {
		message.lineas.forEach( function (linea) {
			replacePos.forEach( function (field) {
				var fieldLowerCase = field.toLowerCase();
				if (linea[fieldLowerCase] !== undefined) {
					linea[field] = linea[fieldLowerCase];
					delete linea[fieldLowerCase];
				}
			});
		});
	}
	return message;

};

var eliminarCamposInnecesarios = function(message) {

	removeCab.forEach( function (field) {
		delete message[field];
	});
	removeCabEmptyString.forEach( function (field) {
		if (message[field] === '')	delete message[field];
	});
	removeCabEmptyArray.forEach( function (field) {
		if (typeof message[field].push === 'function' && message[field].length === 0)	delete message[field];
	});
	removeCabZeroValue.forEach( function (field) {
		if (message[field] === 0)	delete message[field];
	});

	removeCabIfFalse.forEach( function (field) {
		if (message[field] === false)	delete message[field];
	});




	if (message.lineas) {
		message.lineas.forEach( function (linea) {
			removePos.forEach( function (field) {
				delete linea[field];
			});
			removePosEmptyString.forEach( function (field) {
				if (linea[field] === '')	delete linea[field];
			});
			removePosEmptyArray.forEach( function (field) {
				if (linea[field] && typeof linea[field].push === 'function' && linea[field].length === 0)	delete linea[field];
			});
			removePosZeroValue.forEach( function (field) {
				if (linea[field] === 0)	delete linea[field];
			});
			removePosIfFalse.forEach( function (field) {
				if (linea[field] === false)	delete linea[field];
			});

			if (linea.servicioDemorado) {
				linea.estadoServicio = 'SR';
			}

		});
	}
	return message;
};

var establecerNumeroPedido = function(message, pedidoOriginal) {
	message.numeroPedido = pedidoOriginal.crc;
	return message;
};

var establecerFechas = function(message) {
	if (!message.fechaPedido)
		message.fechaPedido = Date.toFedicomDateTime();
	return message;
};

var eliminaIncidenciasDeBloqueos = function(message) {

	var lengthBefore = message.length;

	message = message.filter(function(item) {
    	return !item || !item.codigo || !item.codigo.startsWith('SAP-IGN');
	});

	if (lengthBefore !== message.length) {
		var error = new FedicomError('PED-ERR-999', 'No se pudo guardar el pedido. Contacte con su comercial.');
		message.push(error.getErrors()[0]);
	}

	return message;
}

module.exports = function(msg, pedidoOriginal) {

	var message = JSON.parse(JSON.stringify(msg));

	// Si el mensaje es un array, no hay que sanearlo
	if (Array.isArray(message)) {
		message = eliminaIncidenciasDeBloqueos(message);
		return message;
	}

	message = sanearMayusculas(message);
	message = establecerNumeroPedido(message, pedidoOriginal);
	message = establecerFechas(message);
	message = eliminarCamposInnecesarios(message);

	return message;
};
