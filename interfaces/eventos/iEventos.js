'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');

module.exports.devoluciones = require('./iEventosDevoluciones');
module.exports.pedidos = require('./iEventosPedidos');
module.exports.autenticacion = require('./iEventosAutenticacion');
module.exports.sap = require('./iEventosSap');
module.exports.retransmisiones = require('./iEventosRetransmisiones');
module.exports.logistica = require('./iEventosLogistica');
module.exports.consultas = require('./iEventosConsulta');
module.exports.confirmacionAlbaran = require('./iEventosConfirmacionAlbaran');

module.exports.descartar = (req, res, cuerpoRespuesta, error) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.INVALIDO, K.TX_STATUS.DESCONOCIDO);
	if (error) {
		if (error?.body) {
			transaccion['$set'].clientRequest.body = error.body;
			delete error.body;
		}
		transaccion['$set'].clientRequest.error = error;
	}

	L.xi(txId, ['Emitiendo evento de descarte'], 'txCommit');
	iMongo.transaccion.descartar(transaccion);

}


