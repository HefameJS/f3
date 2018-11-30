

const Imongo = require('../interfaces/imongo');
const ObjectID = Imongo.ObjectID;


module.exports.emitAuthRequest = function (req) {

	var reqData = {
		$setOnInsert: { _id: req.txId },
		$set: {
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

	Imongo.commit(reqData);
}
module.exports.emitAuthResponse = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: { _id: res.txId },
		$set: {
			status: status || 'OK',
			clientResponse: {
				status: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	Imongo.commit(resData);
}

module.exports.emitSapRequest = function (txId, req) {
	var data = {
      $setOnInsert: { _id: txId },
		$set: {
			crc: new ObjectID(req.body.crc),
      	status: 'SENT_TO_SAP',
      	sapRequest: {
				method: req.method,
				headers: req.headers,
				body: req.body
			}
		}
	}

	Imongo.buffer(data);
}
module.exports.emitSapResponse = function (txId, res, body, error) {
	var statusCodeType = ( (res && res.statusCode) ? Math.floor(res.statusCode / 100) : 0);
	var sapResponse;

	if (error) {
		sapResponse = {
			error: {
				source: 'NET',
				statusCode: error.errno || 'UNDEFINED',
				message: error.message
			}
		}
	} else if (statusCodeType !== 2) {
		sapResponse = {
			error: {
				source: 'SAP',
				statusCode: res.statusCode,
				message: res.statusMessage
			}
		}
	} else {
		sapResponse = {
			statusCode: res.statusCode,
			headers: res.headers,
			body: body
		}
	}

	var data = {
		$setOnInsert: { _id: txId },
		$set: {
    		status: 'BACK_FROM_SAP',
    		sapResponse: sapResponse
		}
	}

	// console.log(data);
   Imongo.buffer(data);
}



module.exports.emitDiscard = function (req, res, responseBody, error) {

	var data = {
		$setOnInsert: { _id: req.txId },
		$set: {
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
				statusCode: res.statusCode,
				headers: res.getHeaders ? res.getHeaders() : null,
				body: responseBody
			}
		}
	}
	Imongo.commit(data);
}

module.exports.emitPedDuplicated = function (req, res, responseBody, originalTx) {

	var data = {
		$setOnInsert: { _id: originalTx._id },
		$push: {
			duplicates: {
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

	Imongo.commit(data);
}
module.exports.emitPedError = function (req, res, responseBody, status) {

	var data = {
		$setOnInsert: { _id: req.txId },
		$set: {
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	Imongo.commit(data);
}
module.exports.emitPedReq = function(req, pedido) {
	var reqData = {
		$setOnInsert: { _id: req.txId, crc: new ObjectID(pedido.crc) },
		$set: {
			type: 'PEDIDO',
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
	};

	Imongo.commit(reqData);
}
module.exports.emitPedRes = function (res, responseBody, status) {
	var resData = {
		$setOnInsert: { _id: res.txId },
		$set: {
			status: status || 'OK',
			clientResponse: {
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	Imongo.commit(resData);
}
