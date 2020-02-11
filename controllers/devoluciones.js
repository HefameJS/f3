'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

const Isap = require(BASE + 'interfaces/isap');
const Imongo = require(BASE + 'interfaces/imongo');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const Devolucion = require(BASE + 'model/devolucion/devolucion');
const Tokens = require(BASE + 'util/tokens');
const Flags = require(BASE + 'interfaces/cache/flags')


exports.saveDevolucion = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CREACION DE DEVOLUCION']);

	req.token = Tokens.verifyJWT(req.token, req.txId);
	if (req.token.meta.exception) {
		L.xe(req.txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		var responseBody = req.token.meta.exception.send(res);
		Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}

	// Comprobación de si la devolución es una simulacion hecha desde la APP
	// En cuyo caso se aceptará si el token que viene es del dominio HEFAME, tiene el permiso 'F3_SIMULADOR' y
	// el concentrador está en modo desarrollo (config.produccion === false)
	if (req.token.aud === K.DOMINIOS.HEFAME) {
		if (C.production === true) {
			L.xw(req.txId, ['El concentrador está en PRODUCCION. No se admiten devoluciones simuladas.', req.token.perms])
			var error = new FedicomError('AUTH-005', 'El concentrador está en PRODUCCION. No se admiten devoluciones simuladas.', 403);
			var responseBody = error.send(res);
			Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, K.TX_STATUS.NO_AUTORIZADO);
			return;
		}
		if (!req.token.perms || !req.token.perms.includes('FED3_SIMULADOR')) {
			L.xw(req.txId, ['El usuario no tiene los permisos necesarios para realizar una devolución', req.token.perms])
			var error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
			var responseBody = error.send(res);
			Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, K.TX_STATUS.NO_AUTORIZADO);
			return;
		} else {
			L.xi(req.txId, ['La devolución es simulada por un usuario del dominio', req.token.sub])
			let newToken = Tokens.generateJWT(req.txId, req.body.authReq, [])
			L.xd(req.txId, ['Se ha generado un token para la devolución simulada. Se sustituye por el de la petición simulada', newToken])
			req.headers['authorization'] = 'Bearer ' + newToken
			req.token = Tokens.verifyJWT(newToken, req.txId);
		}
	}

	L.xi(req.txId, ['El token transmitido resultó VALIDO'], 'txToken');


	L.xd(req.txId, ['Analizando el contenido de la transmisión']);
	try {
  		var devolucion = new Devolucion(req);
	} catch (fedicomError) {
		fedicomError = FedicomError.fromException(req.txId, fedicomError);
		L.xe(req.txId, ['Ocurrió un error al analizar la petición', fedicomError])
		var responseBody = fedicomError.send(res);
		Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}
	L.xd(req.txId, ['El contenido de la transmisión es una devolución correcta', devolucion]);


	Imongo.findCrcDuplicado(devolucion.crc, function (err, dbTx) {
		if (err) {
			L.xe(req.txId, ['Ocurrió un error al comprobar si la devolución está duplicada - Se asume que no lo es', err], 'crc');
		}

		if (dbTx) {
			var duplicatedId = dbTx._id;
			L.xi(req.txId, 'Detectada la transmisión de devolución con ID ' + duplicatedId + ' con identico CRC', 'crc');
			L.xi(duplicatedId, 'Se ha detectado un duplicado de esta devolución con ID ' + req.txId, 'crc');
			var errorDuplicado = new FedicomError('DEV-ERR-999', 'Devolución duplicada', 400);
			var responseBody = errorDuplicado.send(res);
			Events.devoluciones.emitDevolucionDuplicada(req, res, responseBody, duplicatedId);
		} else {
			Events.devoluciones.emitInicioCrearDevolucion(req, devolucion);
			devolucion.limpiarEntrada(req.txId);
			Isap.realizarDevolucion(req.txId, devolucion, (sapError, sapResponse) => {

				if (sapError) {
					if (sapError.type === K.ISAP.ERROR_TYPE_NO_SAPSYSTEM) {
						var fedicomError = new FedicomError('HTTP-400', sapError.code, 400);
						L.xe(req.txId, ['Error al grabar la devolución', sapError]);
						var responseBody = fedicomError.send(res);
						Events.devoluciones.emitFinCrearDevolucion(res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
					}
					else {
						L.xe(req.txId, ['Incidencia en la comunicación con SAP - No se graba la devolución', sapError]);
						var fedicomError = new FedicomError('DEV-ERR-999', 'No se pudo registrar la devolución - Inténtelo de nuevo mas tarde', 503);
						var responseBody = fedicomError.send(res)
						Flags.set(req.txId, K.FLAGS.NO_SAP)
						Events.devoluciones.emitFinCrearDevolucion(res, responseBody, K.TX_STATUS.NO_SAP);
					}
					return;
				}

				var clientResponse = devolucion.obtenerRespuestaCliente(req.txId, sapResponse.body);
				var [estadoTransmision, numerosDevolucion] = clientResponse.estadoTransmision();

				res.status(201).json(clientResponse);
				Events.devoluciones.emitFinCrearDevolucion(res, clientResponse, estadoTransmision, { numerosDevolucion });

			});


		}
	});


}


exports.getDevolucion = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CONSULTA DE DEVOLUCION']);

	var numeroDevolucion = req.params.numeroDevolucion || req.query.numeroDevolucion;

	if (!numeroDevolucion) {
		var fedicomError = new FedicomError('DEV-ERR-999', 'El parámetro "numeroDevolucion" es inválido', 400);
		var responseBody = fedicomError.send(res);
		Events.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	req.token = Tokens.verifyJWT(req.token);
	if (req.token.meta.exception) {
		// Fallo en el login
		var responseBody = req.token.meta.exception.send(res);
		Events.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.FALLO_AUTENTICACION);
		return;
	}


	Events.devoluciones.emitRequestConsultarDevolucion(req);
	Imongo.findTxByNumeroDevolucion(req.txId, numeroDevolucion, function (err, dbTx) {
		if (err) {
			var error = new FedicomError('HTTP-500', 'No se pudo obtener la devolución - Inténtelo de nuevo mas tarde', 500);
			var responseBody = error.send(res);
			Events.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.CONSULTA.ERROR_DB);
			return;
		}

		L.xi(req.txId, ['Se recupera la transmisión de la base de datos', dbTx]);

		if (dbTx && dbTx.clientResponse)	{
			// TODO: Autorizacion
			var originalBody = dbTx.clientResponse.body;
			var documentoDevolucion = null;

			if (originalBody && originalBody.length) {
				originalBody.some( function (doc) {
					if (doc && doc.numeroDevolucion && doc.numeroDevolucion === numeroDevolucion) {
						documentoDevolucion = doc;
						return true;
					}
					return false;
				});
			}

			if (documentoDevolucion) {
				res.status(200).json(documentoDevolucion);
				Events.devoluciones.emitResponseConsultarDevolucion(res, documentoDevolucion, K.TX_STATUS.OK);
			} else {
				L.xe(req.txId, ['No se encontró la devolución dentro de la transmisión.']);
				var error = new FedicomError('DEV-ERR-001', 'La devolución solicitada no existe', 404);
				var responseBody = error.send(res);
				Events.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.CONSULTA.NO_EXISTE);
			}
		} else {
			var error = new FedicomError('DEV-ERR-001', 'La devolución solicitada no existe', 404);
			var responseBody = error.send(res);
			Events.devoluciones.emitErrorConsultarDevolucion(req, res, responseBody, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	});

}
