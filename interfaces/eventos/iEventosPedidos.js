'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Interfaces
const iEventosComun = require('./iEventosComun');
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iflags/iFlags');


module.exports.inicioPedido = (req, pedido) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoDeApertura(req, K.TX_TYPES.PEDIDO, K.TX_STATUS.RECEPCIONADO);
	transaccion['$set'].crc = new M.ObjectID(pedido.crc);
	transaccion['$set'].crcSap = parseInt(pedido.crc.substring(0, 8), 16);
	pedido.metadatos.fechaRecepcion = transaccion['$setOnInsert'].createdAt;

	L.xi(txId, ['Emitiendo COMMIT para evento InicioCrearPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.PEDIDO, K.TX_STATUS.RECEPCIONADO, [req.identificarUsuarioAutenticado(), pedido.crc, req.body]);

}

module.exports.finPedido = (res, cuerpoRespuesta, estadoFinal, datosExtra) => {
	let txId = res.txId;
	if (!datosExtra) datosExtra = {};

	let transaccion = iEventosComun.generarEventoDeCierre(res, cuerpoRespuesta, estadoFinal);
	transaccion['$set'].numeroPedidoAgrupado = datosExtra.numeroPedidoAgrupado || undefined;
	transaccion['$set'].numerosPedidoSAP = datosExtra.numerosPedidoSAP || [];
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento FinCrearPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.PEDIDO, estadoFinal, [cuerpoRespuesta]);
}

module.exports.errorPedido = (req, res, cuerpoRespuesta, estadoFinal) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.PEDIDO, estadoFinal)
	iFlags.finaliza(txId, transaccion);

	L.xi(txId, ['Emitiendo COMMIT para evento ErrorCrearPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txId, K.TX_TYPES.PEDIDO, estadoFinal, [req.identificarUsuarioAutenticado(), cuerpoRespuesta]);
}

module.exports.pedidoDuplicado = (req, res, cuerpoRespuesta, txIdOriginal) => {

	let txId = req.txId;

	let transaccion = iEventosComun.generarEventoCompleto(req, res, cuerpoRespuesta, K.TX_TYPES.PEDIDO_DUPLICADO, K.TX_STATUS.OK)
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


	L.xi(txId, ['Emitiendo COMMIT para evento PedidoDuplicado'], 'txCommit');
	iMongo.transaccion.grabar(transaccionActualizacionOriginal);
	iMongo.transaccion.grabar(transaccion);
}