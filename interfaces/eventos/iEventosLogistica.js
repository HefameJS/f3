'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iflags/iFlags');


module.exports.inicioLogistica = (req, logistica) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoDeApertura(req, K.TX_TYPES.LOGISTICA, K.TX_STATUS.RECEPCIONADO);
	transaccion['$set'].crc = new M.ObjectID(logistica.crc);

	L.xi(txId, ['Emitiendo COMMIT para evento inicioLogistica'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.LOGISTICA, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), logistica.crc, req.body]);
}

module.exports.finLogistica = (res, cuerpoRespuesta, estadoFinal, datosExtra) => {

	let txId = res.txId;
	if (!datosExtra) datosExtra = {};

	let transaccion = iEventosComun.generarEventoDeCierre(res, cuerpoRespuesta, estadoFinal);
	transaccion['$set'].numeroLogistica = datosExtra.numeroLogistica || null;
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento finLogistica'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.LOGISTICA, estadoFinal, [cuerpoRespuesta]);
}

module.exports.errorLogistica = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;
	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.LOGISTICA, estadoFinal);
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento errorLogistica'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.LOGISTICA, estadoFinal, [req.identificarUsuarioAutenticado(), cuerpoRespuesta]);
}

module.exports.logisticaDuplicado = (req, res, cuerpoRespuesta, txIdOriginal) => {

	let txId = req.txId;
	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.LOGISTICA_DUPLICADA, K.TX_STATUS.OK);
	transaccion['$set'].originalTx = txIdOriginal;
	iFlags.finaliza(txId, transaccion); // Establece flags que hubiera en la transaccion actual


	let transaccionActualizacionOriginal = {
		$setOnInsert: {
			_id: txIdOriginal,
			createdAt: new Date()
		},
		$push: {
			duplicates: {
				_id: txId,
				timestamp: new Date()
			}
		}
	}
	// Establece el flag 'DUPLICADOS' en la transaccion original
	iFlags.set(txId, C.flags.DUPLICADOS);
	iFlags.finaliza(txId, transaccionActualizacionOriginal);
	

	L.xi(txId, ['Emitiendo COMMIT para evento LogisticaDuplicado'], 'txCommit');
	iMongo.transaccion.grabar(transaccionActualizacionOriginal);
	iMongo.transaccion.grabar(transaccion);
}
