'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iMongo = require('interfaces/imongo/iMongo');
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('global/tokens');
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const DevolucionCliente = require('modelos/devolucion/ModeloDevolucionCliente');
const DevolucionSap = require('modelos/devolucion/ModeloDevolucionSap');


// POST /devoluciones
exports.crearDevolucion = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión de CREACION DE DEVOLUCION']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.devoluciones.errorDevolucion(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let devolucionCliente = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		devolucionCliente = new DevolucionCliente(req);
	} catch (excepcion) {
		// La generación del objeto puede causar una excepción si la petición no era correcta.
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res, 400);
		iEventos.devoluciones.errorDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Si la transmisión no contiene ningúna línea válida, no se hace nada mas con esta.
	if (!devolucionCliente.contieneLineasValidas()) {
		L.xi(txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		let cuerpoRespuesta = [devolucionCliente.generarRespuestaDeTodasLasLineasSonInvalidas()];
		res.status(400).json(cuerpoRespuesta);
		iEventos.devoluciones.errorDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	L.xd(txId, ['El contenido de la transmisión es una devolución correcta']);

	// Control de duplicados
	// 20.10.2020 - El CRC en el modelo de DevolucionCliente se genera usando el timestamp para evitar 
	// duplicados
	/*
	try {
		let txDevolucionDuplicada = await iMongo.consultaTx.porCRC(devolucionCliente.crc);
		if (txDevolucionDuplicada?.clientResponse?.body) {

			let txIdOriginal = txDevolucionDuplicada._id;
			let respuestaCliente = txDevolucionDuplicada.clientResponse.body;
			L.xi(txId, ['Detectada la transmisión de devolucion con idéntico CRC', txIdOriginal], 'crc');
			L.xi(txIdOriginal, 'Se ha recibido una transmisión duplicada de esta con ID ' + txId, 'crc');

			// Añadimos la incidencia de devolución duplicada
			let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_DEV, 'La devolución ya estaba registrada en el sistema')
			respuestaCliente.forEach(devolucionOriginal => {
				// Si la devolucion original tenía número asignado, indicamos que es duplicada.
				// Si no lleva numero, es que probablemente era un error y la dejamos tal cual.
				if (devolucionOriginal.numeroDevolucion) {
					if (!devolucionOriginal.incidencias || !devolucionOriginal.incidencias.push) devolucionOriginal.incidencias = [];
					devolucionOriginal.incidencias = [...devolucionOriginal.incidencias, ...errorFedicom.getErrores()];
				}
			});

			res.status(txDevolucionDuplicada.clientResponse.status).send(respuestaCliente);
			iEventos.devoluciones.devolucionDuplicada(req, res, respuestaCliente, txIdOriginal);
			return;
		}
	} catch (errorMongo) {
		L.xe(txId, ['Ocurrió un error al comprobar si la devolución es duplicada - se asume que no lo es', errorMongo]);
	}
	*/


	iEventos.devoluciones.inicioDevolucion(req, devolucionCliente);

	try {
		let cuerpoRespuestaSap = await iSap.devoluciones.realizarDevolucion(devolucionCliente);

		// Lo primero, vamos a comprobar que SAP nos haya devuelto un array con objetos de devolucion
		if (!Array.isArray(cuerpoRespuestaSap)) {
			L.xe(txId, ['SAP devuelve un cuerpo de respuesta que no es un array. Se devuelve error genérico al cliente', cuerpoRespuestaSap]);
			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'No se pudo registrar la devolución - Inténtelo de nuevo mas tarde', 500);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res)
			iEventos.devoluciones.finDevolucion(res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP);
			return;
		}


		let devolucionesSap = cuerpoRespuestaSap.map(cuerpoDevolucionSap => new DevolucionSap(cuerpoDevolucionSap, txId));

		let {
			cuerpoRespuestaHttp,
			codigoRespuestaHttp,
			estadoTransmision,
			numerosDevolucionSap,
			numeroDevolucion
		} = DevolucionSap.condensar(txId, devolucionesSap, devolucionCliente);

		res.status(codigoRespuestaHttp).json(cuerpoRespuestaHttp);
		iEventos.devoluciones.finDevolucion(res, cuerpoRespuestaHttp, estadoTransmision, { numerosDevolucionSap, numeroDevolucion });

	} catch (errorLlamadaSap) {

		L.xe(txId, ['Incidencia en la comunicación con SAP - No se graba la devolución', errorLlamadaSap]);
		let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_DEV, 'No se pudo registrar la devolución - Inténtelo de nuevo mas tarde', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res)
		iFlags.set(txId, C.flags.NO_SAP)
		iEventos.devoluciones.finDevolucion(res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP);

	}


}



// GET /devoluciones/:numeroDevolucion
// Cuando el content-type es JSON
const _consultaDevolucionJSON = async function (req, res, numeroDevolucion) {

	let txId = req.txId;

	try {
		let dbTx = await iMongo.consultaTx.porNumeroDevolucion(numeroDevolucion);

		if (dbTx?.clientResponse?.body) {

			L.xi(txId, ['Se ha recuperado la transmisión de la base de datos']);
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			let documentoDevolucion = null;

			// La consulta es solo por uno de los objetos de devolución que hay dentro de la
			// transmisión. Lo buscamos...
			if (Array.isArray(cuerpoRespuestaOriginal)) {
				// Las devoluciones devuelven arrays con varios documentos de devolución dentro,
				// buscamos el que tiene el numero de devolución concreta que buscamos.
				documentoDevolucion = cuerpoRespuestaOriginal.find((devolucion) => {
					return (devolucion?.numeroDevolucion === numeroDevolucion);
				});
			}

			if (documentoDevolucion) {
				L.xi(txId, ['Se ha encontrado el documento solicitado']);
				res.status(200).json(documentoDevolucion);
				iEventos.consultas.consultaDevolucion(req, res, documentoDevolucion, K.TX_STATUS.OK, 'JSON');
			} else {
				L.xe(txId, ['No se encontró la devolución dentro de la transmisión. ¡OJO que esto no es normal!']);
				let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, 'JSON');
			}
		} else {
			L.xw(txId, ['No se ha encontrado la transmisión solicitada']);
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, 'JSON');
		}

	} catch (errorMongo) {
		L.xe(txId, ['Error en la consulta a MongoDB', errorMongo])
		let error = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_DEV, 'No se pudo obtener la devolución - Inténtelo de nuevo mas tarde', 500);
		let cuerpoRespuesta = error.enviarRespuestaDeError(res);
		iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB, 'JSON');
		return;
	}

}

// GET /devoluciones/:numeroDevolucion
// Cuando el content-type es PDF
const _consultaDevolucionPDF = async function (req, res, numDevolucion) {

	let txId = req.txId;

	try {
		let cuerpoSap = await iSap.devoluciones.consultaDevolucionPDF(numDevolucion, txId);


		if (cuerpoSap?.[0]?.pdf_file) {
			L.xi(txId, ['Se obtuvo la devolución PDF en Base64 desde SAP']);
			let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', 'attachment; filename=' + numDevolucion + '.pdf');
			res.status(200).send(buffer);
			iEventos.consultas.consultaDevolucion(req, res, { pdf: numDevolucion, bytes: buffer.length }, K.TX_STATUS.OK, numDevolucion, 'PDF');
			return;
		} else {
			L.xi(txId, ['SAP no ha devuelto el albarán', cuerpoSap]);
			let errorFedicom = new ErrorFedicom('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, numDevolucion, 'PDF');
			return;
		}


	} catch (errorLlamadaSap) {

		L.xe(txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba la devolución PDF', errorLlamadaSap]);
		let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'Ocurrió un error en la búsqueda de la devolución', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP, numDevolucion, 'PDF');
		return;

	}
}

// GET /devoluciones/:numeroDevolucion
exports.consultaDevolucion = async function (req, res) {

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
		let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_DEV, 'El parámetro "numeroDevolucion" es obligatorio', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, null);
		return;
	}
	let numDevolucionSaneado = numDevolucion.padStart(10, '0');
	L.xi(txId, ['El número de devolución solicitada', numDevolucionSaneado])


	// Detección del formato solicitado
	let formatoDevolucion;

	if (req.headers['accept']) {
		switch (req.headers['accept'].toLowerCase()) {
			case 'application/pdf': formatoDevolucion = 'PDF'; break;
			default: formatoDevolucion = 'JSON'; break;
		}
	}

	L.xi(txId, ['Se determina el formato solicitado de la devolución', formatoDevolucion, req.headers['accept']]);

	switch (formatoDevolucion) {
		case 'JSON':
			_consultaDevolucionJSON(req, res, numDevolucionSaneado);
			return;
		case 'PDF':
			_consultaDevolucionPDF(req, res, numDevolucionSaneado);
			return;
		default:
			// Nunca vamos a llegar a este caso, pero aquí queda el tratamiento necesario por si acaso
			let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'No se reconoce del formato de la devolución en la cabecera "Accept"', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaDevolucion(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, numDevolucionSaneado, null);
			return;
	}

}
