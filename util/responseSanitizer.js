
const _ = require('underscore');

const removeCab = [ 'login', 'crc' ];
const removePos = [ 'posicion_sap' ];

const replaceCab = [ 'numeroPedido', 'codigoCliente', 'direccionEnvio', 'numeroPedidoOrigen', 'tipoPedido', 'codigoAlmacenServicio', 'fechaPedido', 'fechaServicio', 'cargoCooperativo', 'empresaFacturadora' ];
const replacePos = [ 'codigoArticulo', 'codigoUbicacion', 'codigoArticuloSustituyente', 'cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte', 'valeEstupefaciente', 'fechaLimiteServicio', 'servicioDemorado', 'estadoServicio', 'servicioAplazado' ];

const removeCabEmptyString = [ 'condicion', 'observaciones', 'direccionEnvio', 'empresaFacturadora' ];
const removeCabEmptyArray = [ 'notificaciones', 'incidencias', 'alertas' ];
const removeCabZeroValue = [ 'aplazamiento' ];

const removePosEmptyString = [ 'codigoUbicacion', 'codigoArticuloSustituyente', 'valeEstupefaciente', 'fechaLimiteServicio', 'estadoServicio', 'servicioAplazado' ];
const removePosEmptyArray = [ 'notificaciones', 'incidencias', 'alertas' ];
const removePosZeroValue = [ 'cantidadFalta', 'cantidadBonificacion', 'cantidadBonificacionFalta', 'descuentoPorcentaje', 'descuentoImporte', 'cargoPorcentaje', 'cargoImporte' ];

var sanearIncidencias = function(message) {
	message.lineas.forEach( function(linea) {
		linea.incidencias.forEach( function(incidencia) {
			if (incidencia.codigo === 'X5') {
				incidencia.codigo = 'LIN-PED-WARN-003';
				incidencia.descripcion = 'No trabajado';

				message.incidencias.push({
					codigo: 'PED-WARN-003',
					descripcion: 'No trabajado'
				});
			}
		});
	});

	return message;
};

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
		message.fechaPedido = Date.fedicomDate();
	if (!message.fechaServicio)
		message.fechaServicio = message.fechaPedido;
	return message;
};

module.exports = function(msg, pedidoOriginal) {
	var message = JSON.parse(JSON.stringify(msg));
	message = sanearMayusculas(message);
	message = sanearIncidencias(message);
	message = establecerNumeroPedido(message, pedidoOriginal);
	message = establecerFechas(message);
	message = eliminarCamposInnecesarios(message);
	return message;
};
