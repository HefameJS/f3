'use strict';
const BASE = global.BASE;
// const config = global.config;
const L = global.logger;

const Isap = require(BASE + 'interfaces/isap');
const Imongo = require(BASE + 'interfaces/imongo');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const Tokens = require(BASE + 'util/tokens');
const Pedido = require(BASE + 'model/pedido/pedido');
const sanitizeSapResponse = require(BASE + 'util/responseSanitizer');
const controllerHelper = require(BASE + 'util/controllerHelper');
const txStatus = require(BASE + 'model/static/txStatus');
const saneaPedidosAsociadosSap = require(BASE + 'util/saneaPedidosAsociados');






exports.savePedido = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como ENTRADA DE PEDIDO']);

	req.token = Tokens.verifyJWT(req.token, req.txId);
	if (req.token.meta.exception) {
		L.xe(req.txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		var responseBody = req.token.meta.exception.send(res);
		Events.pedidos.emitErrorCrearPedido(req, res, responseBody, txStatus.FALLO_AUTENTICACION);
		return;
	}
	L.xi(req.txId, ['El token transmitido resultó VALIDO', req.token], 'txToken');

	L.xd(req.txId, ['Analizando el contenido de la transmisión']);
	try {
  		var pedido = new Pedido(req);
	} catch (ex) {
		var responseBody = controllerHelper.sendException(ex, req, res);
		Events.pedidos.emitErrorCrearPedido(req, res, responseBody, txStatus.PETICION_INCORRECTA);
		return;
	}
	L.xd(req.txId, ['El contenido de la transmisión es un pedido correcto', pedido]);



	Imongo.findTxByCrc(req.txId, pedido, function (err, dbTx) {
		if (err) {
			L.xw(req.txId, ['Se asume que el pedido no es duplicado']);
		}

		if (dbTx && dbTx.clientResponse)	{
			L.xi(req.txId, 'Detectado pedido duplicado');

			var dupeResponse = dbTx.clientResponse.body;
			if (dbTx.clientResponse.statusCode === 201 && dupeResponse) {
				if (!dupeResponse.incidencias) {
					dupeResponse.incidencias = [ {codigo: 'PED-ERR-008', descripcion: 'Pedido duplicado'} ];
				} else {
					dupeResponse.incidencias.push({codigo: 'PED-ERR-008', descripcion: 'Pedido duplicado'});
				}
			} else if (dupeResponse && dupeResponse.push) {
				dupeResponse.push({codigo: 'PED-ERR-008', descripcion: 'Pedido duplicado'});
			}

			res.status(dbTx.clientResponse.statusCode).json(dupeResponse);
			Events.pedidos.emitPedidoDuplicado(req, res, dupeResponse, dbTx);

		} else {
			Events.pedidos.emitRequestCrearPedido(req, pedido);
			pedido.clean();
			Isap.realizarPedido( req.txId, pedido, function(sapErr, sapRes, sapBody, abort) {
				if (sapErr) {
					if (abort) {
						var fedicomError = new FedicomError('HTTP-400', sapErr, 400);
						var responseBody = fedicomError.send(res);
						Events.pedidos.emitResponseCrearPedido(res, responseBody, txStatus.SISTEMA_SAP_NO_DEFINIDO);
					} else {
						L.xe(req.txId, ['Incidencia en la comunicación con SAP', sapErr]);
						pedido.simulaFaltas();
						res.status(201).json(pedido);
						Events.pedidos.emitResponseCrearPedido(res, pedido, txStatus.NO_SAP);
					}
					return;
				}

				
				var status = txStatus.ESPERANDO_NUMERO_PEDIDO;
				var numerosPedidoSAP = undefined;

				// Si es un pedido inmediato, SAP debe haber devuelto los numeros de pedido asociados
				if (sapBody.sap_pedidoprocesado) {
					status = txStatus.SIN_NUMERO_PEDIDO_SAP;
					numerosPedidoSAP = saneaPedidosAsociadosSap(sapBody.sap_pedidosasociados);
					if (numerosPedidoSAP) {
						status = txStatus.OK;
					}
				}
				var response = sanitizeSapResponse(sapBody, pedido);

				if (Array.isArray(response)) {
					res.status(409).json(response);
					Events.pedidos.emitResponseCrearPedido(res, response, txStatus.RECHAZADO_SAP);
				} else {
					res.status(201).json(response);
					Events.pedidos.emitResponseCrearPedido(res, response, status, numerosPedidoSAP); // OK!
				}
			});
		}
	});

}

exports.getPedido = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CONSULTA DE PEDIDO']);

	var numeroPedido = req.params.numeroPedido || req.query.numeroPedido;


	req.token = Tokens.verifyJWT(req.token);
	if (req.token.meta.exception) {
		// Fallo en el login
		var responseBody = req.token.meta.exception.send(res);
		Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, txStatus.FALLO_AUTENTICACION);
		return;
	}


	Events.pedidos.emitRequestConsultarPedido(req);
	Imongo.findTxByCrc(req.txId, numeroPedido, function (err, dbTx) {
		if (err) {
			L.xe(req.txId, ['No se ha podido recuperar el pedido', err]);
			var error = new FedicomError('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
			var responseBody = error.send(res);
			Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, txStatus.PETICION_INCORRECTA);
			return;
		}


		L.xi(req.txId, ['Se recupera la transmisión de la base de datos', dbTx]);


		if (dbTx && dbTx.clientResponse)	{
			// TODO: Autorizacion
			var originalBody = dbTx.clientResponse.body;
			res.status(200).json(originalBody);
			Events.pedidos.emitResponseConsultarPedido(res, originalBody, txStatus.OK);
		} else {
			var error = new FedicomError('PED-ERR-001', 'El pedido solicitado no existe', 404);
			var responseBody = error.send(res);
			Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, txStatus.NO_EXISTE_PEDIDO);
		}
	});

}

exports.updatePedido = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	var error = new FedicomError('PED-ERR-999', 'No se ha implementado el servicio de actualización de pedidos', 501);
	var responseBody = error.send(res);

	L.xw(req.txId, [error]);

}