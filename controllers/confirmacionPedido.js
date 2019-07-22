'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const Events = require(BASE + 'interfaces/events');
//const FedicomError = require(BASE + 'model/fedicomError');
const Tokens = require(BASE + 'util/tokens');
const txStatus = require(BASE + 'model/txStatus');






exports.confirmaPedido = function (req, res) {

	L.xi(req.txId, ['Procesando confirmación de pedido']);

	req.token = Tokens.verifyJWT(req.token, req.txId);

	var confirmacion = req.body;
	L.xd(req.txId, ['Datos de confirmacion recibidos', confirmacion]);

	var response = {
		ok: true
	};

	res.status(200).json(response);
	Events.sap.emitConfirmacionPedido(req, res, response, txStatus.OK);




}
