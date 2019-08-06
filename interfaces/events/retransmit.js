'use strict';
const BASE = global.BASE;
const L = global.logger;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const txTypes = require(BASE + 'model/static/txTypes');
const txStatus = require(BASE + 'model/static/txStatus');

function identifyAuthenticatingUser(req) {
	if (req && req.token && req.token.sub) {
		return req.token.sub;
	}
	return undefined;
}

function identifyClient(req) {
	if (req && req.body && req.body.codigoCliente) {
		return req.body.codigoCliente;
	}
	return undefined;
}

function merge(src1, src2) {
	var newObj = {};
	Object.keys(src1).forEach(function(key) {
		newObj[key] = src1[key];
	});
	Object.keys(src2).forEach(function(key) {
		if (!(key in newObj)) {
		 	newObj[key] = src2[key];
		}
	 });
	return newObj;
}

module.exports.emitRetransmit = function (req, res, responseBody, originalTx, status) {

	var originalTxId = (originalTx && originalTx._id) ? originalTx._id : undefined;
	var forceFlag = req.query.force === 'yes' ? true : false;
	var retransStatus = status !== null ? status : txStatus.PETICION_INCORRECTA;

	var data = {
		$setOnInsert: {
			_id: req.txId,
			createdAt: new Date(),
		},
		$set: {
			type: txTypes.RETRANSMISION_PEDIDO,
			status: retransStatus,
			forced: forceFlag,
			originalTx: originalTxId,
			iid: global.instanceID,
			authenticatingUser: identifyAuthenticatingUser(originalTx.clientRequest || null),
			client: identifyClient(originalTx.clientRequest || null),
			clientRequest: {
				authentication: req.token,
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
				statusCode: res.statusCode,
				headers: res.getHeaders(),
				body: responseBody
			}
		}
	}

	var dataUpdate = null;


	// Hacemos un UPDATE del estado original !
	if ( originalTxId && (originalTx.status !== txStatus.OK && originalTx.status !== txStatus.ESPERANDO_NUMERO_PEDIDO) && originalTx.status !== retransStatus) {
		dataUpdate = {
			$setOnInsert: {
				_id: originalTxId,
				createdAt: new Date()
			},
			$set: {
				clientResponse: data['$set'].clientResponse,
				status: data['$set'].status,
				modifiedAt: new Date()
			},
			$push: {
				retransmissions: {
					_id: data['$setOnInsert']._id,
					createdAt: data['$setOnInsert'].createdAt,
					oldStatus: originalTx.status,
					oldClientResponse: originalTx.clientResponse,
					dataChange: true,
					forced: forceFlag,
					rtStatus: retransStatus
				}
			}
		};
	} else {
		dataUpdate = {
			$setOnInsert: {
				_id: originalTxId,
				createdAt: new Date()
			},
			$push: {
				retransmissions: {
					_id: data['$setOnInsert']._id,
					createdAt: data['$setOnInsert'].createdAt,
					dataChange: false,
					force: forceFlag,
					rtStatus: retransStatus
				}
			}
		};
	}

	console.log(dataUpdate);

	L.xi(req.txId, ['Emitiendo COMMIT para evento Retransmit', data['$set'], dataUpdate['$setOnInsert'], dataUpdate['$set'], dataUpdate['$push']], 'txCommit');

	if (originalTxId) Imongo.commit(dataUpdate);
	Imongo.commit(data);

	var newStatus = dataUpdate['$set'] ? dataUpdate['$set'].status || originalTx.status : originalTx.status;
	var yellData = {
		retransmissionTxId: req.txId,
		oldStatus: originalTx.status,
		newStatus: newStatus,
		dataUpdated: dataUpdate['$set'] ? true : false
	};
	if (originalTxId) yellData.originalTx = originalTxId;

	L.yell(originalTxId, txTypes.RETRANSMISION_PEDIDO, newStatus, [yellData]);

}
