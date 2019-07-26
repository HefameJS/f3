'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;
const Isap = require(BASE + 'interfaces/isap');
const Imongo = require(BASE + 'interfaces/imongo');
const Events = require(BASE + 'interfaces/events');
const FedicomError = require(BASE + 'model/fedicomError');
const Devolucion = require(BASE + 'model/devolucion/devolucion');
const Tokens = require(BASE + 'util/tokens');
const sanearDevolucionSAP = require(BASE + 'util/devolucionesSanitizer');
const controllerHelper = require(BASE + 'util/controllerHelper');
const txStatus = require(BASE + 'model/static/txStatus');





exports.saveDevolucion = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CREACION DE DEVOLUCION']);

	req.token = Tokens.verifyJWT(req.token, req.txId);
	if (req.token.meta.exception) {
		L.xe(req.txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		var responseBody = req.token.meta.exception.send(res);
		Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, txStatus.FALLO_AUTENTICACION);
		return;
	}
	L.xi(req.txId, ['El token transmitido resultó VALIDO', req.token], 'txToken');


	L.xd(req.txId, ['Analizando el contenido de la transmisión']);
	try {
  		var devolucion = new Devolucion(req);
	} catch (ex) {
		var responseBody = controllerHelper.sendException(ex, req, res);
		Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, txStatus.PETICION_INCORRECTA);
		return;
	}
	L.xd(req.txId, ['El contenido de la transmisión es una devolución correcta', devolucion]);


	L.xd(req.txId, ['Comprobando si la devolución es un duplicado', devolucion.crc], 'txCRC');
	Imongo.findTxByCrc( devolucion, function (err, dbTx) {
		if (err) {
			L.xe(req.txId, ['Error al buscar duplicados. Se asume que la devolución no es duplicado', err], 'txCRC');
		}

		if (dbTx && dbTx.clientResponse)	{
			L.xw(req.txId, ['Se encontró un duplicado de la transmisión', dbTx], 'txCRC');

			var dupeResponse = dbTx.clientResponse.body;

			if (dbTx.clientResponse.statusCode === 201 && dupeResponse.length > 0) {
				dupeResponse.forEach( function (dev) {
					if (!dev.incidencias) {
						dev.incidencias = [ {codigo: 'PED-WARN-Z99', descripcion: 'Devolución duplicada'} ];
					} else {
						dev.incidencias.push({codigo: 'PED-WARN-Z99', descripcion: 'Devolución duplicada'});
					}
				});
			}

			res.status(dbTx.clientResponse.statusCode).json(dupeResponse);
			Events.devoluciones.emitDevolucionDuplicada(req, res, dupeResponse, dbTx);

		} else {
			L.xd(req.txId, ['No se encontró ninguna transmisión anterior con este CRC', err, dbTx], 'txCRC');
			Events.devoluciones.emitRequestDevolucion(req, devolucion);

			Isap.realizarDevolucion( req.txId, devolucion, function(sapErr, sapRes, sapBody, abort) {
				if (sapErr) {
					if (abort) {
						var fedicomError = new FedicomError('HTTP-400', sapErr, 400);
						var responseBody = fedicomError.send(res);
						Events.devoluciones.emitResponseDevolucion(res, responseBody, txStatus.PETICION_INCORRECTA);
					} else {
						L.xe(req.txId, ['Incidencia en la comunicación con SAP', sapErr]);
						var fedicomError = new FedicomError('HTTP-503', 'No se pudo registrar la devolución - Inténtelo de nuevo mas tarde', 503);
						var responseBody = fedicomError.send(res)
						Events.devoluciones.emitResponseDevolucion(res, responseBody, txStatus.NO_SAP);
						return;
					}
				}

				var response = sanearDevolucionSAP(sapBody, devolucion);
				res.status(201).json(response);
				Events.devoluciones.emitResponseDevolucion(res, response, txStatus.OK);

			});


		}
	});


}


exports.getDevolucion = function (req, res) {

	L.xi(req.txId, ['Procesando transmisión como CONSULTA DE DEVOLUCION']);
	res.status(503).json(new FedicomError(503, 'No implementado', 503));

}
