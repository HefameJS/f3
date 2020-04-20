'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iSap = require(BASE + 'interfaces/isap/iSap');
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iEventos = require(BASE + 'interfaces/eventos/iEventos');
const iTokens = require(BASE + 'util/tokens');
const iFlags = require(BASE + 'interfaces/iFlags');

// Modelos
const FedicomError = require(BASE + 'model/fedicomError');
const Logistica = require(BASE + 'model/logistica/ModeloLogistica');


// POST /logistica
exports.crearLogistica = function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CREACION DE SOLICITUD DE LOGISTICA']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.logistica.errorLogistica(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	let logistica = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		logistica = new Logistica(req);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(txId, fedicomError);
		L.xe(txId, ['Ocurrió un error al analizar la petición', fedicomError]);
		let cuerpoRespuesta = fedicomError.send(res);
		iEventos.logistica.errorLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	if (!logistica.contienteLineasValidas()) {
		L.xd(txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		let cuerpoRespuesta = logistica;
		res.status(400).json(cuerpoRespuesta);
		iEventos.logistica.errorLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xd(txId, ['El contenido de la transmisión es una solicitud de logistica correcta', logistica]);

	iMongo.consultaTx.porCRC(txId, logistica.crc, (errorMongo, transmisionOriginal) => {
		if (errorMongo) {
			L.xe(txId, ['Ocurrió un error al comprobar si el pedido logístico es duplicado - Se asume que no lo es', errorMongo], 'crc');
			dbTx = null;
		} else if (transmisionOriginal && transmisionOriginal.clientResponse && transmisionOriginal.clientResponse.body) {
			let idTxOriginal = transmisionOriginal._id;
			let cuerpoRespuestaOriginal = transmisionOriginal.clientResponse.body;
			L.xi(txId, 'Detectada la transmisión de pedido logístico con ID ' + idTxOriginal + ' con identico CRC', 'crc');
			L.xi(transmisionOriginal, 'Se ha detectado un duplicado de este pedido logístico con ID ' + txId, 'crc');
			let errorDuplicado = new FedicomError('LOG-ERR-008', 'Solicitud logística duplicada', 400);
			if (!cuerpoRespuestaOriginal.incidencias) cuerpoRespuestaOriginal.incidencias = [];
			cuerpoRespuestaOriginal.incidencias.push(errorDuplicado.getErrors());
			res.status(201).json(cuerpoRespuestaOriginal);
			iEventos.logistica.logisticaDuplicado(req, res, cuerpoRespuestaOriginal, idTxOriginal);
			return;
		}

		iEventos.logistica.inicioLogistica(req, logistica);
		logistica.limpiarEntrada(txId);
		iSap.logistica.realizarLogistica(txId, logistica, (errorLlamadaSap, respuestaSap) => {

			if (errorLlamadaSap) {
				if (errorLlamadaSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
					let fedicomError = new FedicomError('HTTP-400', errorLlamadaSap.code, 400);
					L.xe(txId, ['Error al grabar la devolución', errorLlamadaSap]);
					let cuerpoRespuesta = fedicomError.send(res);
					//iEventos.logistica.finLogistica(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
				}
				else {
					L.xe(txId, ['Incidencia en la comunicación con SAP - No se graba la solicitud de logística', errorLlamadaSap]);
					let fedicomError = new FedicomError('DEV-ERR-999', 'No se pudo registrar la solicitud - Inténtelo de nuevo mas tarde', 503);
					let cuerpoRespuesta = fedicomError.send(res)
					iFlags.set(txId, K.FLAGS.NO_SAP)
					iEventos.logistica.finLogistica(res, cuerpoRespuesta, K.TX_STATUS.NO_SAP);
				}
				return;
			}

			let respuestaCliente = logistica.obtenerRespuestaCliente(txId, respuestaSap.body);
			let [estadoTransmision, numeroLogistica, codigoRespuestaHttp] = respuestaCliente.estadoTransmision();

			res.status(codigoRespuestaHttp).json(respuestaCliente);
			iEventos.logistica.finLogistica(res, respuestaCliente, estadoTransmision, { numeroLogistica });
		});
	});
}


// GET /logistica
// GET /logistica/:numeroLogistica
exports.consultaLogistica = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como CONSULTA DE LOGISTICA']);

	// Comprobación del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.logistica.consultaLogistica(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let numeroLogistica = req.params.numeroLogistica || req.query.numeroLogistica;
	iEventos.pedidos.emitRequestConsultarPedido(req);
	iMongo.consultaTx.porNumeroLogistica(txId, numeroLogistica, (errorMongo, dbTx) => {
		if (errorMongo) {
			L.xe(txId, ['No se ha podido recuperar el pedido de logística', errorMongo]);
			let error = new FedicomError('LOG-ERR-005', 'El parámetro "numeroLogistica" es inválido', 400);
			let responseBody = error.send(res);
			iEventos.logistica.consultaLogistica(req, res, responseBody, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}

		L.xi(txId, ['Se ha recuperado la transmisión de la base de datos']);

		if (dbTx && dbTx.clientResponse) {
			// TODO: Autorizacion
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			res.status(200).json(cuerpoRespuestaOriginal);
			iEventos.logistica.consultaLogistica(req, res, cuerpoRespuestaOriginal, K.TX_STATUS.OK);
		} else {
			let error = new FedicomError('LOG-ERR-001', 'El pedido logístico solicitado no existe', 404);
			let cuerpoRespuesta = error.send(res);
			iEventos.logistica.consultaLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}
