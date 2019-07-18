'use strict';
const BASE = global.BASE;
const L = global.logger;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/txTypes');
const txStatus = require(BASE + 'model/txStatus');


module.exports.emitSapRequest = function (txId, url, req) {
	var data = {
      $setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
      	status: txStatus.ESPERANDO_INCIDENCIAS,
      	sapRequest: {
				timestamp: new Date(),
				method: req.method,
				headers: req.headers,
				body: req.body,
				url: url
			}
		}
	}

	if (req.body.crc) data['$set'].crc = new ObjectID(req.body.crc);

	L.xi(txId, ['Emitiendo BUFFER para evento SapRequest', data['$set']], 'txBuffer');
	Imongo.buffer(data);
}
module.exports.emitSapResponse = function (txId, res, body, error) {
	var statusCodeType = ( (res && res.statusCode) ? Math.floor(res.statusCode / 100) : 0);
	var sapResponse;

	if (error) {
		sapResponse = {
			timestamp: new Date(),
			error: {
				source: 'NET',
				statusCode: error.errno || false,
				message: error.message
			}
		}
	} else if (statusCodeType !== 2) {
		sapResponse = {
			timestamp: new Date(),
			error: {
				source: 'SAP',
				statusCode: res.statusCode,
				message: res.statusMessage
			}
		}
	} else {
		sapResponse = {
			timestamp: new Date(),
			statusCode: res.statusCode,
			headers: res.headers,
			body: body
		}
	}

	var data = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
    		status: txStatus.INCIDENCIAS_RECIBIDAS,
    		sapResponse: sapResponse
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento SapResponse', data['$set']], 'txBuffer');
   Imongo.buffer(data);
}



module.exports.emitConfirmacionPedido = function (req, res, responseBody, status) {

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: status,
			iid: global.instanceID
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.CONFIRMACION_PEDIDO,
			clientRequest: {
				ip: req.ip,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			},
			clientResponse: {
				timestamp: new Date(),
				status: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}



	L.xi(req.txId, ['Emitiendo COMMIT para evento AuthRequest', reqData['$set']], 'txCommit');
	Imongo.commit(reqData);
}
