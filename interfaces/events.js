
const Imongo = require('../interfaces/imongo');
const ObjectID = Imongo.ObjectID;

const L = global.logger;

module.exports.emitAuthRequest = function (req) {

	var reqData = {
		$setOnInsert: { _id: req.txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			type: 'AUTH',
			status: 'RECEIVED',
			clientRequest: {
				ip: req.ip,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				route: req.route.path,
				headers: req.headers,
				body: req.body
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento AuthRequest', reqData['$set']], 'txCommit');
	Imongo.commit(reqData);
}
module.exports.emitAuthResponse = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: { _id: res.txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			status: status || 'OK',
			clientResponse: {
				timestamp: new Date(),
				status: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento AuthResponse', resData['$set']], 'txCommit');
	Imongo.commit(resData);
}

module.exports.emitSapRequest = function (txId, req) {
	var data = {
      $setOnInsert: { _id: txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
      	status: 'SENT_TO_SAP',
      	sapRequest: {
				timestamp: new Date(),
				method: req.method,
				headers: req.headers,
				body: req.body
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
				statusCode: error.errno || 'UNDEFINED',
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
		$setOnInsert: { _id: txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
    		status: 'BACK_FROM_SAP',
    		sapResponse: sapResponse
		}
	}

	L.xi(txId, ['Emitiendo BUFFER para evento SapResponse', data['$set']], 'txBuffer');
   Imongo.buffer(data);
}



module.exports.emitDiscard = function (req, res, responseBody, error) {

	var data = {
		$setOnInsert: { _id: req.txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			type: 'DESCARTADO',
			status: 'DESCARTADO',
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
}

module.exports.emitPedDuplicated = function (req, res, responseBody, originalTx) {

	var data = {
		$setOnInsert: { _id: originalTx._id, createdAt: new Date() },
		$push: {
			duplicates: {
				timestamp: new Date(),
				clientRequest: {
					ip: req.ip,
					protocol: req.protocol,
					method: req.method,
					url: req.originalUrl,
					headers: req.headers,
					body: req.body
				},
				clientResponse: {
					statusCode: res.statusCode,
					headers: res.getHeaders(),
					body: responseBody
				}
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento PedDuplicated', data['$push'].duplicates], 'txCommit');
	Imongo.commit(data);
}
module.exports.emitPedError = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: { _id: req.txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			type: 'PEDIDO',
			status: status || 'DESCARTADO',
			clientRequest: {
				ip: req.ip,
				protocol: req.protocol,
				method: req.method,
				url: req.originalUrl,
				headers: req.headers,
				body: req.body
			},
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(req.txId, ['Emitiendo COMMIT para evento PedError', data['$set']], 'txCommit');
	Imongo.commit(data);
}
module.exports.emitPedReq = function(req, pedido) {
	var reqData = {
		$setOnInsert: { _id: req.txId, crc: new ObjectID(pedido.crc), createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			type: 'PEDIDO',
			status: 'RECEIVED',
			clientRequest: {
				authentication: req.token,
      		ip: req.ip,
      		protocol: req.protocol,
      		method: req.method,
      		url: req.originalUrl,
      		route: req.route.path,
      		headers: req.headers,
      		body: req.body
			}
		}
	};

	L.xi(req.txId, ['Emitiendo COMMIT para evento PedReq', reqData['$set']], 'txCommit');
	Imongo.commit(reqData);
}
module.exports.emitPedRes = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: { _id: res.txId, createdAt: new Date() },
		$set: {
			modifiedAt: new Date(),
			status: status || 'OK',
			clientResponse: {
				timestamp: new Date(),
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	L.xi(res.txId, ['Emitiendo COMMIT para evento PedRes', resData['$set']], 'txCommit');
	Imongo.commit(resData);
}
