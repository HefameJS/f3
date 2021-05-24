'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
//const M = global.mongodb;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iMongo = require('interfaces/imongo/iMongo');
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('global/tokens');
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const LogisticaCliente = require('modelos/logistica/ModeloLogisticaCliente');
const LogisticaSap = require('modelos/logistica/ModeloLogisticaSap');


// POST /logistica
exports.crearLogistica = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CREACION DE PEDIDO DE LOGISTICA']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.pedidos.errorPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	let logisticaCliente = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		logisticaCliente = new LogisticaCliente(req);
	} catch (excepcion) {
		// La generación del objeto puede causar una excepción si la petición no era correcta.
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xe(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res, 400);
		iEventos.logistica.errorLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Si la transmisión no contiene ningúna línea válida, no se hace nada mas con esta.
	if (!logisticaCliente.contienteLineasValidas()) {
		L.xd(txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		let cuerpoRespuesta = logisticaCliente.generarRespuestaDeTodasLasLineasSonInvalidas();
		res.status(400).json(cuerpoRespuesta);
		iEventos.logistica.errorLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xd(txId, ['El contenido de la transmisión es una solicitud de logística correcta', logisticaCliente]);


	// Control de duplicados
	try {
		let txOriginal = await iMongo.consultaTx.duplicadoDeCRC(txId, logisticaCliente);
		let txIdOriginal = txOriginal._id;

		if (txIdOriginal) {
			L.xi(txId, ['Detectada la transmisión de logística con idéntico CRC', txIdOriginal], 'crc');
			L.xi(txIdOriginal, 'Se ha recibido una transmisión duplicada de este pedido de logística con ID ' + txId, 'crc');

			if (txOriginal.status === K.TX_STATUS.LOGISTICA.SIN_NUMERO_LOGISTICA ||
				txOriginal.status === K.TX_STATUS.RECHAZADO_SAP ||
				txOriginal.status === K.TX_STATUS.FALLO_AUTENTICACION ||
				txOriginal.status === K.TX_STATUS.PETICION_INCORRECTA) {
				L.xi(txId, ['La transmisión original no se llegó a materializar, no la tomamos como repetida', txIdOriginal.status]);
				iFlags.set(txId, C.flags.REINTENTO_CLIENTE, txIdOriginal._id);
			} else {
				let errorDuplicado = new ErrorFedicom('LOG-ERR-008', 'Solicitud de logística duplicada', 400);
				let cuerpoRespuesta = errorDuplicado.enviarRespuestaDeError(res);
				iEventos.logistica.logisticaDuplicado(req, res, cuerpoRespuesta, txIdOriginal);
				return;
			}

		} else {
			L.xt(txId, ['No se ha detectado pedido duplicado'], 'crc');
		}
	} catch (errorMongo) {
		L.xe(txId, ['Ocurrió un error al comprobar si el pedido de logística es duplicado - Se asume que no lo es', errorMongo], 'crc');
	}



	iEventos.logistica.inicioLogistica(req, logisticaCliente);


	try {

		let cuerpoRespuestaSap = await iSap.logistica.realizarLogistica(logisticaCliente);

		// Si la respuesta de SAP es un array de incidencias
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
					codigo: K.INCIDENCIA_FEDICOM.ERR_LOG,
					descripcion: 'No se pudo guardar el pedido de logística. Contacte con su comercial.'
				});
			}

			res.status(409).json(incidenciasSaneadas);
			iEventos.logistica.finLogistica(res, incidenciasSaneadas, K.TX_STATUS.RECHAZADO_SAP);
			return;
		}


		// Lo primero, vamos a comprobar que SAP nos haya devuelto un objeto con la respuesta logística. 
		// En ocasiones la conexión peta y la respuesta no puede recuperarse, por lo que tratamos este caso como que SAP está caído.
		if (!cuerpoRespuestaSap) {
			L.xe(txId, ['SAP devuelve un cuerpo de respuesta que no es un objeto válido.', cuerpoRespuestaSap]);
			let errorFedicom = new ErrorFedicom('LOG-ERR-999', 'Ocurrió un error al procesar la petición.', 500)
			let respuestaError = errorFedicom.enviarRespuestaDeError(res);
			iFlags.set(txId, C.flags.NO_SAP);
			iEventos.pedidos.finPedido(res, respuestaError, K.TX_STATUS.ERROR_RESPUESTA_SAP);
			return;
		}


		// Si la respuesta de SAP es un Objeto, lo procesamos y mandamos las faltas al cliente
		let logisticaSap = new LogisticaSap(cuerpoRespuestaSap, txId);
		let respuestaCliente = logisticaSap.generarJSON();

		res.status(201).json(respuestaCliente);
		iEventos.logistica.finLogistica(res, respuestaCliente, logisticaSap.getEstadoTransmision(), {
			numeroLogistica: logisticaSap.numeroLogistica
		});


	} catch (errorLlamadaSap) {
		L.xe(txId, ['Incidencia en la comunicación con SAP - No se graba la solicitud de logística', errorLlamadaSap]);
		let errorFedicom = new ErrorFedicom('DEV-ERR-999', 'No se pudo registrar la solicitud - Inténtelo de nuevo mas tarde', 503);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res)
		iFlags.set(txId, C.flags.NO_SAP)
		iEventos.logistica.finLogistica(res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP);
		return;
	}
}


// GET /logistica
// GET /logistica/:numeroLogistica
exports.consultaLogistica = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como CONSULTA DE LOGISTICA']);

	// Comprobación del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.consultas.consultaLogistica(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let numeroLogistica = req.params.numeroLogistica || req.query.numeroLogistica;
	if (!numeroLogistica) {
		L.xe(txId, ['No se ha espedificado ningún número de logística']);
		let errorFedicom = new ErrorFedicom('LOG-ERR-005', 'El parámetro "numeroLogistica" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	try {
		let dbTx = await iMongo.consultaTx.porNumeroLogistica(numeroLogistica);

		L.xi(txId, ['Se ha recuperado la transmisión de la base de datos']);

		if (dbTx?.clientResponse?.body) {
			// TODO: Autorizacion
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			res.status(200).json(cuerpoRespuestaOriginal);
			iEventos.consultas.consultaLogistica(req, res, cuerpoRespuestaOriginal, K.TX_STATUS.OK);
		} else {
			let errorFedicom = new ErrorFedicom('LOG-ERR-001', 'La orden logística solicitada no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	} catch (errorMongo) {
		L.xe(txId, ['No se ha podido recuperar el pedido de logística', errorMongo]);
		let errorFedicom = new ErrorFedicom('LOG-ERR-005', 'El parámetro "numeroLogistica" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaLogistica(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB);
		return;
	}


}
