'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');



module.exports.devoluciones = require('./iEventosDevoluciones');
module.exports.pedidos = require('./iEventosPedidos');
module.exports.autenticacion = require('./iEventosAutenticacion');
module.exports.sap = require('./iEventosSap');
module.exports.retransmisiones = require('./iEventosRetransmisiones');
module.exports.logistica = require('./iEventosLogistica');


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
	L.xi(req.txId, ['Emitiendo COMMIT DISCARD para evento Discard'], 'txCommit');
	iMongo.transaccion.descartar(data);
}


