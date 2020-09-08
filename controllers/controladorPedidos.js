'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iMongo = require('interfaces/imongo/iMongo');
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('util/tokens');
const iFlags = require('interfaces/iFlags');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');
const Pedido = require('model/pedido/ModeloPedido');



// POST /pedido
exports.crearPedido = (req, res) => {
	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como ENTRADA DE PEDIDO']);


	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.pedidos.errorPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let pedido = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		pedido = new Pedido(req);
	} catch (excepcion) {
		let errorFedicom = ErrorFedicom.desdeExcepcion(txId, excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom])
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.pedidos.errorPedido(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}
	L.xd(txId, ['El contenido de la transmisión es un pedido correcto']);


	iMongo.consultaTx.duplicadoDeCRC(txId, pedido.crc, (errorMongo, txIdOriginal) => {
		if (errorMongo) {
			L.xe(txId, ['Ocurrió un error al comprobar si el pedido es duplicado - Se asume que no lo es', errorMongo], 'crc');
		}
		else if (txIdOriginal) {
			L.xi(txId, 'Detectada la transmisión de pedido con ID ' + txIdOriginal + ' con identico CRC', 'crc');
			L.xi(txIdOriginal, 'Se ha detectado un duplicado de este pedido con ID ' + txId, 'crc');
			let errorFedicom = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado: ' + pedido.crc, 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.pedidos.pedidoDuplicado(req, res, cuerpoRespuesta, txIdOriginal);
			return
		}

		iEventos.pedidos.inicioPedido(req, pedido);
		pedido.limpiarEntrada(txId);

		iSap.realizarPedido(txId, pedido, (errorSap, respuestaSap) => {
			if (errorSap) {
				if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
					let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
					L.xe(txId, ['Error al grabar el pedido', errorSap]);
					let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
					iEventos.pedidos.finPedido(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
				}
				else {
					L.xe(txId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', errorSap]);
					pedido.simulaFaltas();
					res.status(202).json(pedido);
					iFlags.set(txId, K.FLAGS.NO_SAP);
					iFlags.set(txId, K.FLAGS.NO_FALTAS);
					iEventos.pedidos.finPedido(res, pedido, K.TX_STATUS.NO_SAP);
				}
				return;
			}

			let respuestaCliente = pedido.obtenerRespuestaCliente(txId, respuestaSap.body);
			let [estadoTransmision, numeroPedidoAgrupado, numerosPedidoSAP] = respuestaCliente.estadoTransmision();

			let responseHttpStatusCode = respuestaCliente.isRechazadoSap() ? 409 : 201;
			res.status(responseHttpStatusCode).json(respuestaCliente);
			iEventos.pedidos.finPedido(res, respuestaCliente, estadoTransmision, { numeroPedidoAgrupado, numerosPedidoSAP });
		});

	});

}

// GET /pedido
// GET /pedido/:numeroPedido
exports.consultaPedido = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como CONSULTA DE PEDIDO']);

	// Comprobación del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.consultas.consultaPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let numeroPedido = (req.params ? req.params.numeroPedido : null) || (req.query ? req.query.numeroPedido : null);
	
	iMongo.consultaTx.porCRC(txId, numeroPedido, (errorMongo, dbTx) => {
		if (errorMongo) {
			L.xe(txId, ['No se ha podido recuperar el pedido', errorMongo]);
			let errorFedicom = new ErrorFedicom('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}

		L.xi(txId, ['Se ha recuperado el pedido de la base de datos']);

		if (dbTx && dbTx.clientResponse) {
			// TODO: Autorizacion
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			// TODO: Incluir el status original
			res.status(200).json(cuerpoRespuestaOriginal);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuestaOriginal, K.TX_STATUS.OK);
		} else {
			let errorFedicom = new ErrorFedicom('PED-ERR-001', 'El pedido solicitado no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}

// PUT /pedido
exports.actualizarPedido = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	let errorFedicom = new ErrorFedicom('PED-ERR-999', 'No se ha implementado el servicio de actualización de pedidos', 501);
	/*let cuerpoRespuesta = */errorFedicom.enviarRespuestaDeError(res);

	L.xw(txId, [errorFedicom]);

}