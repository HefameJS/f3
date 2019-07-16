'use strict';
const BASE = global.BASE;
const L = global.logger;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/txTypes');
const txStatus = require(BASE + 'model/txStatus');


function identifyAuthenticatingUser(req) {
	if (req && req.body && req.body.user) {
		return req.body.user;
	}
	return undefined;
}


module.exports.emitAuthRequest = function (req) {

	var reqData = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
			status: txStatus.RECEPCIONADO,
			authenticatingUser: identifyAuthenticatingUser(req),
			iid: global.instanceID
		},
		$set: {
			modifiedAt: new Date(),
			type: txTypes.AUTENTICAR,
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
		$setOnInsert: {
			_id: res.txId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
			status: status,
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