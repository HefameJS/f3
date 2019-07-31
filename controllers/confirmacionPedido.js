'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const Events = require(BASE + 'interfaces/events');
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
		Events.pedidos.emitConfirmacionPedido(req, res, responseBody, txStatus.PETICION_INCORRECTA);
		return;
	}

	res.status(200).json({ok: true, procesado: confirmacionPedidoSAP});

	Events.sap.emitConfirmacionPedido(req, res, confirmacionPedidoSAP, txStatus.OK);







}
