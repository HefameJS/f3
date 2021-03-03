'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iMongo = require('interfaces/imongo/iMongo');
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('global/tokens');
const iFlags = require('interfaces/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const PedidoCliente = require('modelos/pedido/ModeloPedidoCliente');
const PedidoSap = require('modelos/pedido/ModeloPedidoSap');



// POST /pedido
exports.crearPedido = async function (req, res) {
	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como ENTRADA DE PEDIDO']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.pedidos.errorPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let pedidoCliente = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		pedidoCliente = new PedidoCliente(req);
	} catch (excepcion) {
		// La generación del objeto puede causar una excepción si la petición no era correcta.
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xw(txId, ['Ocurrió un error al analizar la petición', errorFedicom])
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.pedidos.errorPedido(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Si la transmisión no contiene ningúna línea válida, no se hace nada mas con esta.
	if (!pedidoCliente.contieneLineasValidas()) {
		L.xw(txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		let cuerpoRespuesta = pedidoCliente.generarRespuestaDeTodasLasLineasSonInvalidas();
		res.status(400).json(cuerpoRespuesta);
		iEventos.pedidos.errorPedido(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xi(txId, ['El contenido de la transmisión es un pedido correcto']);


	// Control de duplicados
	try {
		let txIdOriginal = await iMongo.consultaTx.duplicadoDeCRC(txId, pedidoCliente.crc);

		if (txIdOriginal) {
			L.xi(txId, ['Detectada la transmisión de pedido con idéntico CRC', txIdOriginal], 'crc');
			L.xi(txIdOriginal, 'Se ha recibido una transmisión duplicada de este pedido con ID ' + txId, 'crc');
			let errorFedicom = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado: ' + pedidoCliente.crc, 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.pedidos.pedidoDuplicado(req, res, cuerpoRespuesta, txIdOriginal);
			return;
		} else {
			L.xt(txId, ['No se ha detectado pedido duplicado'], 'crc');
		}
	} catch (errorMongo) {
		L.xe(txId, ['Ocurrió un error al comprobar si el pedido es duplicado - Se asume que no lo es', errorMongo], 'crc');
	}



	iEventos.pedidos.inicioPedido(req, pedidoCliente);

	try {

		let cuerpoRespuestaSap = await iSap.pedidos.realizarPedido(pedidoCliente);

		// Si la respuesta de SAP es un array ...
		if (Array.isArray(cuerpoRespuestaSap)) {

			L.xw(txId, ['SAP devuelve un cuerpo de respuesta que es un array con errores de rechazo', cuerpoRespuestaSap]);
			// Eliminamos las incidencias cuyo código comienza por 'SAP-IGN', ya que dan información sobre el bloqueo del cliente
			// y no queremos que esta información se mande al clietne.
			let bloqueoCliente = false;
			let incidenciasSaneadas = cuerpoRespuestaSap.filter((incidencia) => {
				bloqueoCliente = Boolean(incidencia?.codigo?.startsWith('SAP-IGN'));
				return !bloqueoCliente && Boolean(incidencia);
			});

			// Si el cliente está bloqueado, agregamos la incidencia de error de bloqueo en SAP y levantamos el Flag
			if (bloqueoCliente) {
				L.xw(txId, ['SAP indica que el cliente tiene bloqueos de pedidos']);
				iFlags.set(txId, C.flags.BLOQUEO_CLIENTE)
				incidenciasSaneadas.push({
					codigo: K.INCIDENCIA_FEDICOM.ERR_PED,
					descripcion: 'No se pudo guardar el pedido. Contacte con su comercial.'
				});
			}

			res.status(409).json(incidenciasSaneadas);
			iEventos.pedidos.finPedido(res, incidenciasSaneadas, K.TX_STATUS.RECHAZADO_SAP);
			return;
		}


		// Lo primero, vamos a comprobar que SAP nos haya devuelto un objeto con las faltas del pedido. 
		// En ocasiones la conexión peta y la respuesta no puede recuperarse, por lo que tratamos este caso como que SAP está caído.
		if (!cuerpoRespuestaSap || !cuerpoRespuestaSap.crc) {
			L.xe(txId, ['SAP devuelve un cuerpo de respuesta que no es un objeto válido. Se devuelve error de faltas simuladas', cuerpoRespuestaSap]);
			let respuestaFaltasSimuladas = pedidoCliente.gererarRespuestaFaltasSimuladas();
			res.status(202).json(respuestaFaltasSimuladas);
			iFlags.set(txId, C.flags.NO_SAP);
			iFlags.set(txId, C.flags.NO_FALTAS);
			iEventos.pedidos.finPedido(res, respuestaFaltasSimuladas, K.TX_STATUS.NO_SAP);
			return;
		}




		// Si la respuesta de SAP es un Objeto, lo procesamos y mandamos las faltas al cliente
		let pedidoSap = new PedidoSap(cuerpoRespuestaSap, pedidoCliente.crc, txId);
		let respuestaCliente = pedidoSap.generarJSON();

		res.status(201).json(respuestaCliente);
		iEventos.pedidos.finPedido(res, respuestaCliente, pedidoSap.getEstadoTransmision(), {
			numeroPedidoAgrupado: pedidoSap.getNumeroPedidoAgrupado(),
			numerosPedidoSAP: pedidoSap.getNumerosPedidoSap()
		});


	} catch (errorLlamadaSap) {
		
		if (errorLlamadaSap?.esSistemaSapNoDefinido && errorLlamadaSap.esSistemaSapNoDefinido()) {
			L.xe(txId, ['Error al autenticar al usuario', errorLlamadaSap]);
			let errorFedicom = new ErrorFedicom('HTTP-400', errorLlamadaSap.mensaje, 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		} else {
			L.xe(txId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', errorLlamadaSap]);
			let respuestaFaltasSimuladas = pedidoCliente.gererarRespuestaFaltasSimuladas();
			res.status(202).json(respuestaFaltasSimuladas);
			iFlags.set(txId, C.flags.NO_SAP);
			iFlags.set(txId, C.flags.NO_FALTAS);
			iEventos.pedidos.finPedido(res, respuestaFaltasSimuladas, K.TX_STATUS.NO_SAP);
		}
	}

}

// GET /pedido
// GET /pedido/:numeroPedido
exports.consultaPedido = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como CONSULTA DE PEDIDO']);

	// Comprobación del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.consultas.consultaPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	let numeroPedido = (req.params ? req.params.numeroPedido : null) || (req.query ? req.query.numeroPedido : null);

	if (!M.ObjectID.isValid(numeroPedido)) {
		L.xe(txId, ['El numero de pedido indicado no es un ObjectID válido', numeroPedido]);
		let errorFedicom = new ErrorFedicom('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.PETICION_INCORRECTA);
		return;
	}

	try {
		let dbTx = await iMongo.consultaTx.porCRC(numeroPedido)
		L.xi(txId, ['Se ha recuperado el pedido de la base de datos']);

		if (dbTx?.clientResponse) {
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			res.status(dbTx.clientResponse.statusCode).json(cuerpoRespuestaOriginal);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuestaOriginal, K.TX_STATUS.OK);
		} else {
			let errorFedicom = new ErrorFedicom('PED-ERR-001', 'El pedido solicitado no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	} catch (errorMongo) {
		L.xe(txId, ['No se ha podido recuperar el pedido de la base de datos', errorMongo]);
		let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_PED, 'Ocurrió un error al recuperar el pedido', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB);
		return;
	}


}

// PUT /pedido
exports.actualizarPedido = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_PED, 'No se ha implementado el servicio de actualización de pedidos', 501);
	let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
	iEventos.descartar(req, res, cuerpoRespuesta);
	L.xw(txId, [errorFedicom]);

}