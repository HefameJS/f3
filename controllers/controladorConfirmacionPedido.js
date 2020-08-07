'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventos = require('interfaces/eventos/iEventos');
const iMongo = require('interfaces/imongo/iMongo');
const iTokens = require('util/tokens');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');
const ConfirmacionPedidoSAP = require('model/pedido/ModeloConfirmacionPedidoSAP');





// POST /confirmaPedido
exports.confirmaPedido = (req, res) => {
	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión de CONFIRMACION DE PEDIDO']);
	
	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) {
		iEventos.sap.errorConfirmacionPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	let confirmacionPedidoSAP = null;
	L.xt(txId, ['Datos de confirmacion recibidos']);
	try {
		confirmacionPedidoSAP = new ConfirmacionPedidoSAP(req);
	} catch (excepcion) {
		let errorFedicom = ErrorFedicom.desdeExcepcion(txId, excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom])
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.sap.errorConfirmacionPedido(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	iMongo.consultaTx.porCRC(txId, confirmacionPedidoSAP.crc, (errorMongo, dbTx) => {
		if (errorMongo) {
			let errorFedicom = ErrorFedicom.desdeExcepcion(txId, errorMongo);
			L.xe(txId, ['No se ha podido recuperar la transmisión a confirmar - Se aborta el proceso', errorFedicom]);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.sap.errorConfirmacionPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO);
			return;
		}

		if (!dbTx) {
			let errorFedicom = new ErrorFedicom('SAP-ERR-400', 'No existe el pedido que se está confirmando', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.sap.errorConfirmacionPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO);
			return;
		}

		let [estadoTransmision, numerosPedidoSAP] = confirmacionPedidoSAP.obtenerEstado();

		let originalTxId = dbTx._id;
		L.xi(txId, ['Se selecciona la transmisión con ID para confirmar', originalTxId], 'confirm');
		res.status(200).json({ok: true});
		iEventos.sap.confirmacionPedido(req, originalTxId, estadoTransmision, { numerosPedidoSAP });

	} );

}
