'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');



module.exports.devoluciones = require('./iEventosDevoluciones');
module.exports.pedidos = require('./iEventosPedidos');
module.exports.autenticacion = require('./iEventosAutenticacion');
module.exports.sap = require('./iEventosSap');
module.exports.retransmisiones = require('./iEventosRetransmisiones');
module.exports.logistica = require('./iEventosLogistica');
module.exports.consultas = require('./iEventosConsulta');

module.exports.descartar = (req, res, responseBody, error) => {

	let txId = req.txId;

	let data = {
		$setOnInsert: {
			_id: txId,
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
	L.xi(txId, ['Emitiendo COMMIT para evento DISCARD'], 'txCommit');
	iMongo.transaccion.descartar(data);
	
}


