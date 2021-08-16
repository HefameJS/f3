'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iflags/iFlags');



const confirmarAlbaran = (req, res, cuerpoRespuesta, estado, datosExtra) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.CONFIRMACION_ALBARAN, estado);
	if (datosExtra) transaccion['$set'] = { ...transaccion['$set'], ...datosExtra};
	//TODO: En 'cuerpoRespuesta' podríamos rascar el codigo del cliente y añadirlo al campo 'client' de la transaccion
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento CONFIRMACION ALBARAN'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
}


module.exports= {
	confirmarAlbaran
}