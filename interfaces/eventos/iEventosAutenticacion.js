'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externo
const clone = require('clone');

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iflags/iFlags');


module.exports.inicioAutenticacion = (req) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoDeApertura(req, K.TX_TYPES.AUTENTICACION, K.TX_STATUS.RECEPCIONADO);

	// Ocultamos la contraseña del usuario en los logs
	if (transaccion['$set'].clientRequest.body.password) {
		transaccion['$set'].clientRequest.body = clone(transaccion['$set'].clientRequest.body);
		transaccion['$set'].clientRequest.body.password = '*******'
	}

	L.xi(txId, ['Emitiendo COMMIT para evento AuthRequest'], 'txCommit');
	iMongo.transaccion.grabarEnMemoria(transaccion);
}

module.exports.finAutenticacion = (res, cuerpoRespuesta, estado) => {

	let txId = res.txId;

	let transaccion = iEventosComun.generarEventoDeCierre(res, cuerpoRespuesta, estado);
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento AuthResponse'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
}
