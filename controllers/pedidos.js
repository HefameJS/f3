'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

const Isap = require(BASE + 'interfaces/isap');
const Imongo = require(BASE + 'interfaces/imongo');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const Tokens = require(BASE + 'util/tokens');
const Pedido = require(BASE + 'model/pedido/pedido');
const Flags = require(BASE + 'interfaces/cache/flags')



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

	// Comprobación de si el pedido es una simulacion hecha desde la APP
	// En cuyo caso se aceptará si el token que viene es del dominio HEFAME, tiene el permiso 'F3_SIMULADOR' y
	// el concentrador está en modo desarrollo (config.produccion === false)
	if (req.token.aud === K.DOMINIOS.HEFAME) {
		if (C.production === true) {
			L.xw(txId, ['El concentrador está en PRODUCCION. No se admiten pedidos simulados.', req.token.perms])
			var error = new FedicomError('AUTH-005', 'El concentrador está en PRODUCCION. No se admiten pedidos simulados.', 403);
			var responseBody = error.send(res);
			Events.pedidos.emitErrorCrearPedido(req, res, responseBody, K.TX_STATUS.NO_AUTORIZADO);
			return;
		}
		if (!req.token.perms || !req.token.perms.includes('FED3_SIMULADOR')) {
			L.xw(txId, ['El usuario no tiene los permisos necesarios para realizar un pedido', req.token.perms])
			var error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			var responseBody = error.send(res);
			Events.pedidos.emitErrorCrearPedido(req, res, responseBody, K.TX_STATUS.NO_AUTORIZADO);
			return;
		} else {
			L.xi(txId, ['El pedido es simulado por un usuario del dominio', req.token.sub ])
			let newToken = Tokens.generateJWT(txId, req.body.authReq, [])
			L.xd(txId, ['Se ha generado un token para el pedido simulado. Se sustituye por el de la petición simulada', newToken])
			req.headers['authorization'] = 'Bearer ' + newToken
			req.token = Tokens.verifyJWT(newToken, txId);
		}
	}


	L.xi(txId, ['El token transmitido resultó VALIDO'], 'txToken');

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
			pedido.limpiarEntrada(req.txId);

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
						Flags.set(txId, K.FLAGS.NO_SAP);
						Flags.set(txId, K.FLAGS.NO_FALTAS);
						Events.pedidos.emitFinCrearPedido(res, pedido, K.TX_STATUS.NO_SAP);
					}
					return;
				}


				var clientResponse = pedido.obtenerRespuestaCliente(txId, sapResponse.body);
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
			Events.pedidos.emitErrorConsultarPedido(req, res, responseBody, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}


		L.xi(req.txId, ['Se recupera la transmisión de la base de datos', dbTx]);


		if (dbTx && dbTx.clientResponse) {
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