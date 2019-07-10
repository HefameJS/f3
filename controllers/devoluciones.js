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
const txStatus = require(BASE + 'model/txStatus');





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
		// Hay fallo al parsear el mensaje de devolución
		var responseBody = ex.send(res);
		L.xe(req.txId, ['Se detectó un error en el contenido de la transmisión. Se transmite el error al cliente', ex, responseBody]);
		Events.devoluciones.emitErrorCrearDevolucion(req, res, responseBody, txStatus.PETICION_INCORRECTA);
		return;
	}
	L.xd(req.txId, ['El conenido de la transmisión es una devolución correcta', devolucion]);



	Imongo.findTxByCrc( devolucion, function (err, dbTx) {
		if (err) {
			L.xw(req.txId, ['Se asume que la devolución no es duplicado']);
		}

		if (dbTx && dbTx.clientResponse)	{
			console.log("La devolución es un duplicado");

			var dupeResponse = dbTx.clientResponse.body;
			if (!dupeResponse.errno) {
				if (!dupeResponse.incidencias) {
					dupeResponse.incidencias = [ {codigo: 'PED-WARN-Z99', descripcion: 'Devolución duplicada'} ];
				} else {
					dupeResponse.incidencias.push({codigo: 'PED-WARN-Z99', descripcion: 'Devolución duplicada'});
				}
			}

			res.status(dbTx.clientResponse.statusCode).json(dupeResponse);
			Events.devoluciones.emitDevolucionDuplicada(req, res, dupeResponse, dbTx);

		} else {

			Events.devoluciones.emitRequestDevolucion(req, devolucion);

			Isap.realizarDevolucion( req.txId, devolucion, function(sapErr, sapRes, sapBody) {
				if (sapErr) {
					console.log("INDICENCIA EN LA COMUNICACION SAP");
					console.log(sapErr);
					res.status(500).json(sapErr);
					Events.devoluciones.emitResponseDevolucion(res, sapErr, txStatus.NO_SAP);
					return;
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
