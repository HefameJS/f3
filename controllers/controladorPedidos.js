'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iSap = require(BASE + 'interfaces/isap');
const iMongo = require(BASE + 'interfaces/imongo');
const iEventos = require(BASE + 'interfaces/eventos/iEventos');
const iTokens = require(BASE + 'util/tokens');
const iFlags = require(BASE + 'interfaces/iFlags');

// Modelos
const FedicomError = require(BASE + 'model/fedicomError');
const Pedido = require(BASE + 'model/pedido/ModeloPedido');



// POST /pedido
exports.crearPedido = function (req, res) {
	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como ENTRADA DE PEDIDO']);


	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.errorPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let pedido = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		pedido = new Pedido(req);
	} catch (exception) {
		let fedicomError = FedicomError.fromException(txId, exception);
		L.xe(txId, ['Ocurrió un error al analizar la petición', fedicomError])
		let responseBody = fedicomError.send(res);
		iEventos.pedidos.errorPedido(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}
	L.xd(txId, ['El contenido de la transmisión es un pedido correcto']);


	iMongo.findCrcDuplicado(pedido.crc, (err, dbTx) => {
		if (err) {
			L.xe(txId, ['Ocurrió un error al comprobar si el pedido es duplicado - Se asume que no lo es', err], 'crc');
		}

		if (dbTx) {
			var duplicatedId = dbTx._id;
			L.xi(txId, 'Detectada la transmisión de pedido con ID ' + duplicatedId + ' con identico CRC', 'crc');
			L.xi(duplicatedId, 'Se ha detectado un duplicado de este pedido con ID ' + txId, 'crc');
			var errorDuplicado = new FedicomError('PED-ERR-008', 'Pedido duplicado: ' + pedido.crc, 400);
			var responseBody = errorDuplicado.send(res);
			iEventos.pedidos.pedidoDuplicado(req, res, responseBody, duplicatedId);
		} else {
			iEventos.pedidos.inicioPedido(req, pedido);
			pedido.limpiarEntrada(req.txId);

			iSap.realizarPedido(txId, pedido, (sapError, sapResponse) => {
				if (sapError) {
					if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
						var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
						L.xe(txId, ['Error al grabar el pedido', sapError]);
						var responseBody = fedicomError.send(res);
						iEventos.pedidos.finPedido(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
					}
					else {
						L.xe(txId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', sapError]);
						pedido.simulaFaltas();
						res.status(202).json(pedido);
						iFlags.set(txId, K.FLAGS.NO_SAP);
						iFlags.set(txId, K.FLAGS.NO_FALTAS);
						iEventos.pedidos.finPedido(res, pedido, K.TX_STATUS.NO_SAP);
					}
					return;
				}


				var clientResponse = pedido.obtenerRespuestaCliente(txId, sapResponse.body);
				var [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP] = clientResponse.estadoTransmision();

				var responseHttpStatusCode = clientResponse.isRechazadoSap() ? 409 : 201;
				res.status(responseHttpStatusCode).json(clientResponse);
				iEventos.pedidos.finPedido(res, clientResponse, estadoTransmision, { numeroPedidoAgrupado, numerosPedidoSAP });
			});
		}
	});

}

// GET /pedido
// GET /pedido/:numeroPedido
exports.consultaPedido = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CONSULTA DE PEDIDO']);

	// Comprobación del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.emitErrorConsultarPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let numeroPedido = req.params.numeroPedido || req.query.numeroPedido;
	iEventos.pedidos.emitRequestConsultarPedido(req);
	iMongo.findTxByCrc(req.txId, numeroPedido, function (err, dbTx) {
		if (err) {
			L.xe(req.txId, ['No se ha podido recuperar el pedido', err]);
			var error = new FedicomError('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
			var responseBody = error.send(res);
			iEventos.pedidos.emitErrorConsultarPedido(req, res, responseBody, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}


		L.xi(req.txId, ['Se recupera la transmisión de la base de datos', dbTx]);


		if (dbTx && dbTx.clientResponse) {
			// TODO: Autorizacion
			var originalBody = dbTx.clientResponse.body;
			res.status(200).json(originalBody);
			iEventos.pedidos.emitResponseConsultarPedido(res, originalBody, K.TX_STATUS.OK);
		} else {
			var error = new FedicomError('PED-ERR-001', 'El pedido solicitado no existe', 404);
			var responseBody = error.send(res);
			iEventos.pedidos.emitErrorConsultarPedido(req, res, responseBody, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}

// PUT /pedido
exports.actualizarPedido = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	let error = new FedicomError('PED-ERR-999', 'No se ha implementado el servicio de actualización de pedidos', 501);
	/*let responseBody = */error.send(res);

	L.xw(req.txId, [error]);

}