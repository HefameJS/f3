'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');


module.exports.devoluciones = require('./events/devolucionesEvents');
module.exports.pedidos = require('./events/pedidosEvents');
module.exports.authentication = require('./events/authenticationEvents');
module.exports.sap = require('./events/sapEvents');
module.exports.retransmisiones = require('./events/retransmisiones');




module.exports.emitDiscard = function (req, res, responseBody, error) {

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
			type: K.TX_TYPES.INVALIDO,
			status: K.TX_STATUS.DESCONOCIDO,
			clientRequest: {
				ip: req.originIp,
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
	L.xi(req.txId, ['Emitiendo COMMIT DISCARD para evento Discard', data['$set']], 'txCommit');
	Imongo.commitDiscard(data);
}
