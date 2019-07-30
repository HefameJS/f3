'use strict';
const BASE = global.BASE;
const L = global.logger;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');




module.exports.devoluciones = require('./events/devolucionesEvents');
module.exports.pedidos = require('./events/pedidosEvents');
module.exports.authentication = require('./events/authenticationEvents');
module.exports.sap = require('./events/sapEvents');
module.exports.retransmit = require('./events/retransmit');




module.exports.emitDiscard = function (req, res, responseBody, error) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.INVALIDO,
			status: txStatus.DESCARTADO,
			clientRequest: {
				ip: req.ip,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				headers: req.headers,
				body: ( error ? error.body : req.body )
			},
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders ? res.getHeaders() : null,
				body: responseBody
			}
		}
	}
	L.xi(req.txId, ['Emitiendo COMMIT para evento Discard', data['$set']], 'txCommit');
	Imongo.commit(data);
	L.yell(req.txId, txTypes.INVALIDO, txStatus.DESCARTADO, [data['$set'].clientRequest]);
}
