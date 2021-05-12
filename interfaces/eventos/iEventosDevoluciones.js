'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iflags/iFlags');



module.exports.inicioDevolucion = (req, devolucion) => {
	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoDeApertura(req, K.TX_TYPES.DEVOLUCION, K.TX_STATUS.RECEPCIONADO)
	transaccion['$set'].crc = new M.ObjectID(devolucion.crc);

	L.xi(txId, ['Emitiendo COMMIT para evento InicioCrearDevolucion'], 'txCommit');
	iMongo.transaccion.grabarEnMemoria(transaccion);
	L.evento(txId, K.TX_TYPES.DEVOLUCION, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), devolucion.crc, req.body]);
}

module.exports.finDevolucion = (res, cuerpoRespuesta, estadoFinal, datosExtra) => {

	let txId = res.txId;
	if (!datosExtra) datosExtra = {}

	let transaccion = iEventosComun.generarEventoDeCierre(res, cuerpoRespuesta, estadoFinal);
	transaccion['$set'].numeroDevolucion = datosExtra.numeroDevolucion ?? null;
	transaccion['$set'].numerosDevolucionSap = datosExtra.numerosDevolucionSap || [];
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento FinCrearDevolucion'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.DEVOLUCION, estadoFinal, [cuerpoRespuesta]);
}

module.exports.errorDevolucion = (req, res, cuerpoRespuesta, estado) => {

	let txId = req.txId;
	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.DEVOLUCION, estado);
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento ErrorCrearDevolucion'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.DEVOLUCION, estado, [req.identificarUsuarioAutenticado(), cuerpoRespuesta]);
}

module.exports.devolucionDuplicada = (req, res, cuerpoRespuesta, txIdOriginal) => {

	let txId = req.txId;
	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.DEVOLUCION_DUPLICADA, K.TX_STATUS.OK);
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
	iFlags.set(txIdOriginal, C.flags.DUPLICADOS);
	iFlags.finaliza(txIdOriginal, transaccionActualizacionOriginal);


	L.xi(txId, ['Emitiendo COMMIT para evento DevolucionDuplicada'], 'txCommit');
	iMongo.transaccion.grabar(transaccionActualizacionOriginal);
	iMongo.transaccion.grabar(transaccion);
}


