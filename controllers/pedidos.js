'use strict';
const BASE = global.BASE;
const L = global.logger;
//const C = global.config;
const K = global.constants;

const Isap = require(BASE + 'interfaces/isap');
const Imongo = require(BASE + 'interfaces/imongo');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const Tokens = require(BASE + 'util/tokens');
const Pedido = require(BASE + 'model/pedido/pedido');



exports.savePedido = function (req, res) {
	var txId = req.txId;

	L.xi(txId, ['Procesando transmisión como ENTRADA DE PEDIDO']);

	req.token = Tokens.verifyJWT(req.token, txId);
	if (req.token.meta.exception) {
		L.xe(txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		var responseBody = req.token.meta.exception.send(res);
		Events.pedidos.emitErrorCrearPedido(req, res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}
	L.xi(txId, ['El token transmitido resultó VALIDO', req.token], 'txToken');

	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
  		var pedido = new Pedido(req);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(txId, fedicomError);
		L.xe(txId, ['Ocurrió un error al analizar la petición', fedicomError])
		var responseBody = fedicomError.send(res);
		Events.pedidos.emitErrorCrearPedido(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}
	L.xd(txId, ['El contenido de la transmisión es un pedido correcto', pedido]);


	Imongo.findCrcDuplicado(pedido.crc, function (err, dbTx) {
		if (err) {
			L.xe(txId, ['Ocurrió un error al comprobar si el pedido es duplicado - Se asume que no lo es', err], 'crc');
		}

		if (dbTx) {
			var duplicatedId = dbTx._id;
			L.xi(txId, 'Detectada la transmisión de pedido con ID ' + duplicatedId + ' con identico CRC', 'crc');
			L.xi(duplicatedId, 'Se ha detectado un duplicado de este pedido con ID ' + txId, 'crc');
			var errorDuplicado = new FedicomError('PED-ERR-008', 'Pedido duplicado: ' + pedido.crc, 400);
			var responseBody = errorDuplicado.send(res);
			Events.pedidos.emitPedidoDuplicado(req, res, responseBody, duplicatedId);
		} else {
			Events.pedidos.emitInicioCrearPedido(req, pedido);
			pedido.limpiarEntrada();
			
			Isap.realizarPedido(txId, pedido, (sapError, sapResponse) => {
				if (sapError) {
					if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
						var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
						L.xe(txId, ['Error al grabar el pedido', sapError]);
						var responseBody = fedicomError.send(res);
						Events.pedidos.emitFinCrearPedido(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
					}
					else {
						L.xe(txId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', sapError]);
						pedido.simulaFaltas();
						res.status(202).json(pedido);
						Events.pedidos.emitFinCrearPedido(res, pedido, K.TX_STATUS.NO_SAP);
					}
					return;
				}


				var clientResponse = pedido.obtenerRespuestaCliente(sapResponse.body);
				var [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP] = clientResponse.estadoTransmision();
				
				var responseHttpStatusCode = clientResponse.isRechazadoSap() ? 409 : 201;
				res.status(responseHttpStatusCode).json(clientResponse);
				Events.pedidos.emitFinCrearPedido(res, clientResponse, estadoTransmision, { numeroPedidoAgrupado, numerosPedidoSAP });
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
		Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}


	Events.pedidos.emitRequestConsultarPedido(req);
	Imongo.findTxByCrc(req.txId, numeroPedido, function (err, dbTx) {
		if (err) {
			L.xe(req.txId, ['No se ha podido recuperar el pedido', err]);
			var error = new FedicomError('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
			var responseBody = error.send(res);
			Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
			return;
		}


		L.xi(req.txId, ['Se recupera la transmisión de la base de datos', dbTx]);


		if (dbTx && dbTx.clientResponse)	{
			// TODO: Autorizacion
			var originalBody = dbTx.clientResponse.body;
			res.status(200).json(originalBody);
			Events.pedidos.emitResponseConsultarPedido(res, originalBody, K.TX_STATUS.OK);
		} else {
			var error = new FedicomError('PED-ERR-001', 'El pedido solicitado no existe', 404);
			var responseBody = error.send(res);
			Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}

exports.updatePedido = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	var error = new FedicomError('PED-ERR-999', 'No se ha implementado el servicio de actualización de pedidos', 501);
	var responseBody = error.send(res);

	L.xw(req.txId, [error]);

}