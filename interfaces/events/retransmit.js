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
	if (req && req.clientRequest  && req.clientRequest.authentication && req.clientRequest.authentication.sub) {
		return req.clientRequest.authentication.sub;
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
module.exports.emitAutoRetransmit = function (retransmissionId, originalTx, newStatus, newResponseBody, force) {

	var originalTxId = (originalTx && originalTx._id) ? originalTx._id : undefined;
	newStatus = newStatus !== null ? newStatus : txStatus.PETICION_INCORRECTA;

	var dataSolicitante = {
			$setOnInsert: {
				_id: retransmissionId,
				createdAt: new Date(),
				type: txTypes.RETRANSMISION_PEDIDO,
				forced: force,
				originalTx: originalTxId,
				iid: global.instanceID,
				authenticatingUser: 'WatchDog'
			},
			$max: {
				status: newStatus,
				modifiedAt: new Date()
			}
		};

	var dataUpdate = null;
	// Hacemos un UPDATE del estado original !
	if ( originalTxId && (originalTx.status !== txStatus.OK && originalTx.status !== txStatus.ESPERANDO_NUMERO_PEDIDO) && originalTx.status < newStatus && newResponseBody) {
		dataUpdate = {
			$setOnInsert: {
				_id: originalTxId,
				createdAt: new Date()
			},
			$max: {
				modifiedAt: new Date(),
				status: newStatus
			},
			$set: {
				clientResponse: {
					timestamp: new Date(),
					headers: {
						'x-retransmissionid': retransmissionId
					},
					statusCode: 200,
					body: newResponseBody
				}
			},
			$push: {
				retransmissions: {
					_id: retransmissionId,
					createdAt: new Date(),
					oldStatus: originalTx.status,
					oldClientResponse: originalTx.clientResponse,
					dataChange: true,
					forced: force,
					rtStatus: newStatus
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
					_id: retransmissionId,
					createdAt: new Date(),
					dataChange: false,
					force: force,
					rtStatus: newStatus
				}
			}
		};
	}


	L.xi(retransmissionId, ['Emitiendo COMMIT para evento AutoRetransmit'], 'txCommit');

	if (originalTxId) Imongo.commit(dataUpdate);
	Imongo.commit(dataSolicitante);

	// var newStatus = dataUpdate['$set'] ? dataUpdate['$set'].status || originalTx.status : originalTx.status;
	var yellData = {
		retransmissionTxId: retransmissionId,
		oldStatus: originalTx.status,
		newStatus: newStatus,
		dataUpdated: dataUpdate['$set'] ? true : false
	};
	if (originalTxId) yellData.originalTx = originalTxId;

	L.yell(originalTxId, txTypes.RETRANSMISION_PEDIDO, newStatus, [yellData]);

}

module.exports.emitStatusFix = function (retransmissionId, originalTx, newStatus) {

	var originalTxId = (originalTx && originalTx._id) ? originalTx._id : undefined;
	if (originalTxId) {
		var dataUpdate = {
			$setOnInsert: {
				_id: originalTxId,
				createdAt: new Date()
			},
			$max: {
				status: newStatus,
				modifiedAt: new Date()
			}
		};

		L.xi(originalTxId, ['Emitiendo COMMIT para evento StatusFix'], 'txCommit');
		Imongo.commit(dataUpdate);

		L.yell(originalTxId, txTypes.CREAR_PEDIDO, newStatus, ['StatusFix']);

	}
}

module.exports.emitRecoverConfirmacionPedido = function (originalTx, confirmTx) {

	var cBody = confirmTx.clientRequest.body;

	var numerosPedidoSAP = undefined;
	if (cBody.sap_pedidosasociados) {
		if (cBody.sap_pedidosasociados.push) numerosPedidoSAP = cBody.sap_pedidosasociados;
		else numerosPedidoSAP = [cBody.sap_pedidosasociados];
	}

	var updateData = {
		$setOnInsert: {
			_id: originalTx._id,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: txStatus.OK
		},
		$set: {
			numerosPedidoSAP: numerosPedidoSAP
		},
		$push:{
			sapConfirms: {
				txId: confirmTx._id,
				timestamp: new Date(),
				sapSystem: identifyAuthenticatingUser(confirmTx),
				body: cBody
			}
		}
	}

	var updateConfirmation = {
		$setOnInsert: {
			_id: confirmTx._id,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: txStatus.CONFIRMACION_RECUPERADA
		}
	}

	L.xi(originalTx._id, ['Emitiendo COMMIT para evento RecoverConfirmacionPedido'], 'txCommit');
	Imongo.commit(updateData);
	Imongo.commit(updateConfirmation);

	L.yell(originalTx._id, originalTx.type, txStatus.OK, numerosPedidoSAP);
}
