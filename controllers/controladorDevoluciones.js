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
			
			res.status(txDevolucionDuplicada.clientResponse.status).send(respuestaCliente);
			iEventos.devoluciones.devolucionDuplicada(req, res, respuestaCliente, txIdOriginal);
			return;
		}

		iEventos.devoluciones.inicioDevolucion(req, devolucion);
		devolucion.limpiarEntrada(txId);
		iSap.devoluciones.realizarDevolucion(txId, devolucion, (errorSap, respuestaSap) => {

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
// Cuando el content-type es JSON
const _consultaDevolucionJSON = (req, res, numeroDevolucion) => {

	let txId = req.txId;

	iMongo.consultaTx.porNumeroDevolucion(txId, numeroDevolucion, (errorMongo, dbTx) => {
		if (errorMongo) {
			let error = new ErrorFedicom('DEV-ERR-999', 'No se pudo obtener la devolución - Inténtelo de nuevo mas tarde', 500);
			let cuerpoRespuesta = error.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB, 'JSON');
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
				iEventos.consultas.consultaDevolucion(req, res, documentoDevolucion, K.TX_STATUS.OK, 'JSON');
			} else {
				L.xe(txId, ['No se encontró la devolución dentro de la transmisión.']);
				let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, 'JSON');
			}
		} else {
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, 'JSON');
		}
	});

}

// GET /devoluciones/:numeroDevolucion
// Cuando el content-type es PDF
const _consultaDevolucionPDF = (req, res, numDevolucion) => {

	let txId = req.txId;

	iSap.devoluciones.consultaDevolucionPDF(txId, numDevolucion, (errorSap, respuestaSap) => {
		if (errorSap) {
			if (errorSap.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
				L.xe(txId, ['Error al consultar la devolución PDF', errorSap]);
				let errorFedicom = new ErrorFedicom('HTTP-400', errorSap.code, 400);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, numDevolucion, 'PDF');
				return;
			}
			else {
				// TODO: Cuando el albarán no existe, SAP devuelve un 503. Comprobar si ocurre lo mismo con las devoluciones
				/*if (respuestaSap.statusCode === 503) {
					L.xe(txId, ['SAP devolvió un 503, probablemente la devolución no existe', errorSap]);
					let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
					let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
					iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, numDevolucion, 'PDF');
					return;
				}*/

				L.xe(txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba la devolución PDF', errorSap]);
				let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'Ocurrió un error en la búsqueda de la devolución', 500);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.NO_SAP, numDevolucion, 'PDF');
				return;
			}
		}

		let cuerpoSap = respuestaSap.body;

		if (cuerpoSap && cuerpoSap[0] && cuerpoSap[0].pdf_file) {
			L.xi(txId, ['Se obtuvo la devolución PDF en Base64 desde SAP']);
			let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', 'attachment; filename=' + numDevolucion + '.pdf');
			res.status(200).send(buffer);
			iEventos.consultas.consultaDevolucion(req, res, { pdf: numDevolucion, bytes: buffer.length }, K.TX_STATUS.OK, numDevolucion, 'PDF');
			return;
		}
		else {
			L.xe(txId, ['Ocurrió un error al solicitar la devolución PDF', cuerpoSap]);
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, numDevolucion, 'PDF');
			return;
		}

	});
}

// GET /devoluciones/:numeroDevolucion
exports.consultaDevolucion = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CONSULTA DE DEVOLUCION']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res, {
		admitirSimulaciones: true,
		admitirSimulacionesEnProduccion: true
	});
	if (!estadoToken.ok) {
		iEventos.consultas.consultaDevolucion(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	// Saneado del número de devolucion
	let numDevolucion = req.params.numeroDevolucion;
	if (!numDevolucion) {
		let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'El parámetro "numeroDevolucion" es obligatorio', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, null);
		return;
	}
	let numDevolucionSaneado = numDevolucion.padStart(10, '0');
	L.xi(txId, ['El número de devolución solicitada', numDevolucionSaneado])


	// Detección del formato solicitado
	let formatoDevolucion = 'JSON';

	if (req.headers['accept']) {
		switch (req.headers['accept'].toLowerCase()) {
			case 'application/pdf': formatoDevolucion = 'PDF'; break;
			default: formatoDevolucion = 'JSON'; break;
		}
	}

	L.xd(txId, ['Se determina el formato solicitado de la devolución', formatoDevolucion, req.headers['accept']]);

	switch (formatoDevolucion) {
		case 'JSON':
			return _consultaDevolucionJSON(req, res, numDevolucionSaneado);
		case 'PDF':
			return _consultaDevolucionPDF(req, res, numDevolucionSaneado);
		default:
			// Nunca vamos a llegar a este caso, pero aquí queda el tratamiento necesario por si acaso
			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'No se reconoce del formato de la devolución en la cabecera "Accept"', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, numDevolucionSaneado, null);
			return;
	}

}
