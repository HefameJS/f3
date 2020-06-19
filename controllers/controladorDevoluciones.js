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
const Devolucion = require('model/devolucion/ModeloDevolucion');


// POST /devoluciones
exports.crearDevolucion = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como CREACION DE DEVOLUCION']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.errorDevolucion(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	let devolucion = null;

	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		devolucion = new Devolucion(req);
	} catch (excepcion) {
		let errorFedicom = ErrorFedicom.desdeExcepcion(txId, excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.devoluciones.errorDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	if (!devolucion.contienteLineasValidas()) {
		L.xd(txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		let cuerpoRespuesta = [devolucion.generarRespuestaExclusiones()];
		res.status(400).json(cuerpoRespuesta);
		iEventos.devoluciones.errorDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xd(txId, ['El contenido de la transmisión es una devolución correcta']);

	iMongo.consultaTx.porCRC(txId, devolucion.crc, (errorMongo, txDevolucionDuplicada) => {
		if (errorMongo) {
			L.xe(txId, ['Ocurrió un error al comprobar si la devolución es duplicada - se asume que no lo es', errorMongo]);
		} else if (txDevolucionDuplicada && txDevolucionDuplicada.clientResponse && txDevolucionDuplicada.clientResponse.body) {
			let txIdOriginal = txDevolucionDuplicada._id;
			let respuestaCliente = txDevolucionDuplicada.clientResponse.body;
			L.xw(txId, ['Se ha detectado la transmisión como un duplicada', txIdOriginal]);

			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'La devolución ya estaba registrada en el sistema')
			respuestaCliente.forEach(devolucionOriginal => {
				// Si la devolucion original tenía número asignado, indicamos que es duplicada.
				// Si no lleva numero, es que probablemente era un error y la dejamos tal cual.
				if (devolucionOriginal.numeroDevolucion) {
					if (!devolucionOriginal.incidencias || !devolucionOriginal.incidencias.push) devolucionOriginal.incidencias = [];
					devolucionOriginal.incidencias = devolucionOriginal.incidencias.concat(errorFedicom.getErrors());
				}
			});
			
			res.status(txDevolucionDuplicada.clientResponse.statusCode).send(respuestaCliente);
			iEventos.devoluciones.devolucionDuplicada(req, res, respuestaCliente, txIdOriginal);
			return;
		}

		iEventos.devoluciones.inicioDevolucion(req, devolucion);
		devolucion.limpiarEntrada(txId);
		iSap.realizarDevolucion(txId, devolucion, (errorSap, respuestaSap) => {

			if (errorSap) {
				if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
					let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
					L.xe(txId, ['Error al grabar la devolución', errorSap]);
					let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
					iEventos.devoluciones.finDevolucion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
				}
				else {
					L.xe(txId, ['Incidencia en la comunicación con SAP - No se graba la devolución', errorSap]);
					let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'No se pudo registrar la devolución - Inténtelo de nuevo mas tarde', 503);
					let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res)
					iFlags.set(txId, K.FLAGS.NO_SAP)
					iEventos.devoluciones.finDevolucion(res, cuerpoRespuesta, K.TX_STATUS.NO_SAP);
				}
				return;
			}

			let respuestaCliente = devolucion.obtenerRespuestaCliente(txId, respuestaSap.body);
			let [estadoTransmision, numerosDevolucion, codigoRespuestaHttp] = respuestaCliente.estadoTransmision();

			res.status(codigoRespuestaHttp).json(respuestaCliente);
			iEventos.devoluciones.finDevolucion(res, respuestaCliente, estadoTransmision, { numerosDevolucion });

		});


	})


}

// GET /devoluciones/:numeroDevolucion
exports.consultaDevolucion = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CONSULTA DE DEVOLUCION']);

	let numeroDevolucion = (req.params ? req.params.numeroDevolucion : null) || (req.query ? req.query.numeroDevolucion : null);

	if (!numeroDevolucion) {
		let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'El parámetro "numeroDevolucion" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.devoluciones.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.consultaDevolucion(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	iMongo.consultaTx.porNumeroDevolucion(txId, numeroDevolucion, (errorMongo, dbTx) => {
		if (errorMongo) {
			let error = new ErrorFedicom('DEV-ERR-999', 'No se pudo obtener la devolución - Inténtelo de nuevo mas tarde', 500);
			let cuerpoRespuesta = error.enviarRespuestaDeError(res);
			iEventos.devoluciones.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}

		L.xi(txId, ['Se ha recuperado la devolución de la base de datos']);

		if (dbTx && dbTx.clientResponse) {
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			let documentoDevolucion = null;

			if (cuerpoRespuestaOriginal && cuerpoRespuestaOriginal.find) {
				// Las devoluciones devuelven arrays con varios documentos de devolución dentro,
				// buscamos el que tiene el numero de devolución concreta que buscamos.
				documentoDevolucion = cuerpoRespuestaOriginal.find((devolucion) => {
					return (devolucion && devolucion.numeroDevolucion === numeroDevolucion);
				});
			}

			if (documentoDevolucion) {
				res.status(200).json(documentoDevolucion);
				iEventos.devoluciones.consultaDevolucion(req, res, documentoDevolucion, K.TX_STATUS.OK);
			} else {
				L.xe(txId, ['No se encontró la devolución dentro de la transmisión.']);
				let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.devoluciones.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
			}
		} else {
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.devoluciones.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}
