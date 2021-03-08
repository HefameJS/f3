'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventos = require('interfaces/eventos/iEventos');
const iMongo = require('interfaces/imongo/iMongo');
const iTokens = require('global/tokens');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const ConfirmacionPedidoSAP = require('modelos/pedido/ModeloConfirmacionPedidoSAP');





// POST /confirmaPedido
exports.confirmaPedido = async function(req, res) {
	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión de CONFIRMACION DE PEDIDO']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) {
		iEventos.sap.errorConfirmacionPedido(req, res, estadoToken.motivo);
		return;
	}


	let confirmacionPedidoSAP = null;
	L.xt(txId, ['Datos de confirmacion recibidos']);
	try {
		confirmacionPedidoSAP = new ConfirmacionPedidoSAP(req);
	} catch (excepcion) {
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom])
		errorFedicom.enviarRespuestaDeError(res, 400);
		iEventos.sap.errorConfirmacionPedido(req, res, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	try {
		let dbTxConfirmada = await iMongo.consultaTx.porCrcSap(confirmacionPedidoSAP.crcSap);

		if (!dbTxConfirmada) {
			L.xw(txId, ['No se ha encontrado el pedido que se está confirmando - Se deja pendiete de asociar a pedido', confirmacionPedidoSAP.crcSap]);
			iEventos.sap.errorConfirmacionPedido(req, res, K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO, { crcSap: confirmacionPedidoSAP.crcSap});
		} else {
			let originalTxId = dbTxConfirmada._id;
			L.xi(txId, ['Se selecciona la transmisión para confirmar con ID', originalTxId], 'confirm');
			iEventos.sap.confirmacionPedido(req, originalTxId, confirmacionPedidoSAP.estadoTransmision, { numerosPedidoSAP: confirmacionPedidoSAP.pedidosAsociadosSap, crcSap: confirmacionPedidoSAP.crcSap });
		}
	} catch (errorMongo) {
		L.xe(txId, ['No se ha podido recuperar la transmisión a confirmar - Se deja pendiente de asociar a pedido', errorMongo]);
		iEventos.sap.errorConfirmacionPedido(req, res, K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO, { crcSap: confirmacionPedidoSAP.crcSap });
	}

	res.status(202).json({ ok: true });

}
