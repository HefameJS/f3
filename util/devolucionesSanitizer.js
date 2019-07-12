'use strict';
const BASE = global.BASE;

const _ = require('underscore');

const removeCab = [ 'login', 'crc' ];
const removePos = [ ];

const replaceCab = [ 'numeroDevolucion', 'fechaDevolucion', 'codigoRecogida', 'codigoCliente', 'numeroAlbaranAbono', 'fechaAlbaranAbono', 'empresaFacturadora'];
const replacePos = [ 'numeroAlbaran', 'fechaAlbaran', 'codigoArticulo', 'descripcionArticulo', 'codigoMotivo', 'descripcionMotivo', 'valeEstupefaciente' ];

const removeCabEmptyString = [ 'codigoRecogida', 'numeroAlbaranAbono', 'fechaAlbaranAbono', 'empresaFacturadora', 'observaciones' ];
const removeCabEmptyArray = [ 'incidencias' ];
const removeCabZeroValue = [ ];
const removeCabIfFalse = [ ];

const removePosEmptyString = [ 'numeroAlbaran', 'fechaAlbaran', 'descripcionArticulo', 'lote', 'fechaCaducidad', 'descripcionMotivo', 'valeEstupefaciente', 'observaciones' ];
const removePosEmptyArray = [ 'incidencias' ];
const removePosZeroValue = [ ];
const removePosIfFalse = [ ];




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
		});
	}
	return message;
};




module.exports = function(msg, pedidoOriginal) {

	var message = JSON.parse(JSON.stringify(msg));

	message.forEach( function (msg) {
		msg = sanearMayusculas(msg);
		msg = eliminarCamposInnecesarios(msg);
	})



	return message;
};
