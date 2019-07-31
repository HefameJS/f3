'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const Events = require(BASE + 'interfaces/events');
const Imongo = require(BASE + 'interfaces/imongo');
const FedicomError = require(BASE + 'model/fedicomError');
const ConfirmacionPedidoSAP = require(BASE + 'model/pedido/confirmacionPedidoSAP');
const Tokens = require(BASE + 'util/tokens');
const txStatus = require(BASE + 'model/static/txStatus');
const controllerHelper = require(BASE + 'util/controllerHelper');





exports.confirmaPedido = function (req, res) {

	L.xi(req.txId, ['Procesando confirmación de pedido']);
	req.token = Tokens.verifyJWT(req.token, req.txId);
	L.xd(req.txId, ['Datos de confirmacion recibidos', req.body]);

	try {
		var confirmacionPedidoSAP = new ConfirmacionPedidoSAP(req);
	} catch (ex) {
		var responseBody = controllerHelper.sendException(ex, req, res);
		Events.sap.emitErrorConfirmacionPedido(req, res, responseBody, txStatus.PETICION_INCORRECTA);
		return;
	}

	Imongo.findTxByCrc( confirmacionPedidoSAP.crc, function(err, dbTx) {
		if (err) {
			L.xe(req.txId, ['No se ha podido recuperar la transmisión a confirmar - Se aborta el proceso', err]);
			var responseBody = controllerHelper.sendException(err, req, res);
			Events.sap.emitErrorConfirmacionPedido(req, res, responseBody, txStatus.PETICION_INCORRECTA);
			return;
		}

		if (!dbTx) {
			var error = new FedicomError('SAP-ERR-400', 'No existe el pedido que se está confirmando', 400);
			var responseBody = error.send(res);
			Events.sap.emitErrorConfirmacionPedido(req, res, responseBody, txStatus.NO_EXISTE_PEDIDO);
			return;
		}

		L.xi(req.txId, ['Se selecciona la transmisión con ID para confirmar', dbTx._id], 'confirm');
		res.status(200).json(confirmacionPedidoSAP);
		Events.sap.emitConfirmacionPedido(req, res, confirmacionPedidoSAP, dbTx);

	} );















}
