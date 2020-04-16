'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventos = require(BASE + 'interfaces/eventos/iEventos');
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iTokens = require(BASE + 'util/tokens');

// Modelos
const FedicomError = require(BASE + 'model/fedicomError');
const ConfirmacionPedidoSAP = require(BASE + 'model/pedido/ModeloConfirmacionPedidoSAP');





// POST /confirmaPedido
exports.confirmaPedido = (req, res) => {
	var txId = req.txId;

	L.xi(txId, ['Procesando transmisión de CONFIRMACION DE PEDIDO']);
	
	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) {
		iEventos.sap.errorConfirmacionPedido(req, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}



	L.xt(req.txId, ['Datos de confirmacion recibidos']);
	try {
		var confirmacionPedidoSAP = new ConfirmacionPedidoSAP(req);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(txId, fedicomError);
		L.xe(txId, ['Ocurrió un error al analizar la petición', fedicomError])
		fedicomError.send(res);
		iEventos.sap.errorConfirmacionPedido(req, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	iMongo.consultaTx.porCRC(txId, confirmacionPedidoSAP.crc, function(err, dbTx) {
		if (err) {
			var fedicomError = FedicomError.fromException(txId, err);
			L.xe(req.txId, ['No se ha podido recuperar la transmisión a confirmar - Se aborta el proceso', fedicomError]);
			fedicomError.send(res);
			iEventos.sap.errorConfirmacionPedido(req, K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO);
			return;
		}

		if (!dbTx) {
			var error = new FedicomError('SAP-ERR-400', 'No existe el pedido que se está confirmando', 400);
			error.send(res);
			iEventos.sap.errorConfirmacionPedido(req, K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO);
			return;
		}

		var [estadoTransmision, numerosPedidoSAP] = confirmacionPedidoSAP.obtenerEstado();

		var originalTxId = dbTx._id;
		L.xi(req.txId, ['Se selecciona la transmisión con ID para confirmar', originalTxId], 'confirm');
		res.status(200).json({ok: true});
		iEventos.sap.confirmacionPedido(req, originalTxId, estadoTransmision, { numerosPedidoSAP });

	} );

}
