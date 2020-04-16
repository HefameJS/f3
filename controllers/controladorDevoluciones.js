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
const Devolucion = require(BASE + 'model/devolucion/ModeloDevolucion');


// POST /devoluciones
exports.crearDevolucion = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CREACION DE DEVOLUCION']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.errorDevolucion(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}



	L.xd(req.txId, ['Analizando el contenido de la transmisión']);
	try {
		var devolucion = new Devolucion(req);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(req.txId, fedicomError);
		L.xe(req.txId, ['Ocurrió un error al analizar la petición', fedicomError]);
		var responseBody = fedicomError.send(res);
		iEventos.devoluciones.errorDevolucion(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	if (!devolucion.contienteLineasValidas()) {
		L.xd(req.txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		var responseBody = [devolucion.generarRespuestaExclusiones()];
		res.status(400).json(responseBody);
		iEventos.devoluciones.errorDevolucion(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xd(req.txId, ['El contenido de la transmisión es una devolución correcta', devolucion]);

	iEventos.devoluciones.inicioDevolucion(req, devolucion);
	devolucion.limpiarEntrada(req.txId);
	iSap.realizarDevolucion(req.txId, devolucion, (sapError, sapResponse) => {

		if (sapError) {
			if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
				var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
				L.xe(req.txId, ['Error al grabar la devolución', sapError]);
				var responseBody = fedicomError.send(res);
				iEventos.devoluciones.finDevolucion(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
			}
			else {
				L.xe(req.txId, ['Incidencia en la comunicación con SAP - No se graba la devolución', sapError]);
				var fedicomError = new FedicomError('DEV-ERR-999', 'No se pudo registrar la devolución - Inténtelo de nuevo mas tarde', 503);
				var responseBody = fedicomError.send(res)
				iFlags.set(req.txId, K.FLAGS.NO_SAP)
				iEventos.devoluciones.finDevolucion(res, responseBody, K.TX_STATUS.NO_SAP);
			}
			return;
		}

		var clientResponse = devolucion.obtenerRespuestaCliente(req.txId, sapResponse.body);
		var [estadoTransmision, numerosDevolucion, codigoRespuestaHttp] = clientResponse.estadoTransmision();

		res.status(codigoRespuestaHttp).json(clientResponse);
		iEventos.devoluciones.finDevolucion(res, clientResponse, estadoTransmision, { numerosDevolucion });

	});
}

// GET /devoluciones/:numeroDevolucion
exports.consultaDevolucion = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CONSULTA DE DEVOLUCION']);

	var numeroDevolucion = req.params.numeroDevolucion || req.query.numeroDevolucion;

	if (!numeroDevolucion) {
		var fedicomError = new FedicomError('DEV-ERR-999', 'El parámetro "numeroDevolucion" es inválido', 400);
		var responseBody = fedicomError.send(res);
		iEventos.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.emitErrorConsultarDevolucion(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	iEventos.devoluciones.emitRequestConsultarDevolucion(req);
	iMongo.consultaTx.porCRCDeConfirmacion(req.txId, numeroDevolucion, function (err, dbTx) {
		if (err) {
			var error = new FedicomError('DEV-ERR-999', 'No se pudo obtener la devolución - Inténtelo de nuevo mas tarde', 500);
			var responseBody = error.send(res);
			iEventos.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}

		L.xi(req.txId, ['Se recupera la transmisión de la base de datos']);

		if (dbTx && dbTx.clientResponse) {
			// TODO: Autorizacion
			var originalBody = dbTx.clientResponse.body;
			var documentoDevolucion = null;

			if (originalBody && originalBody.length) {
				originalBody.some(function (doc) {
					if (doc && doc.numeroDevolucion && doc.numeroDevolucion === numeroDevolucion) {
						documentoDevolucion = doc;
						return true;
					}
					return false;
				});
			}

			if (documentoDevolucion) {
				res.status(200).json(documentoDevolucion);
				iEventos.devoluciones.emitResponseConsultarDevolucion(res, documentoDevolucion, K.TX_STATUS.OK);
			} else {
				L.xe(req.txId, ['No se encontró la devolución dentro de la transmisión.']);
				var error = new FedicomError('DEV-ERR-001', 'La devolución solicitada no existe', 404);
				var responseBody = error.send(res);
				iEventos.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.CONSULTA.NO_EXISTE);
			}
		} else {
			var error = new FedicomError('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			var responseBody = error.send(res);
			iEventos.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}
