'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');
const ObjectID = Imongo.ObjectID;
const ConfirmacionPedidoSAP = require(BASE + 'model/pedido/confirmacionPedidoSAP');
const Flags = require(BASE + 'interfaces/cache/flags');


module.exports.emitRetransmision = (rtxId, dbTx, options, rtxStatus, errorMessage, rtxResult) => {
	L.xd(rtxId, ['Emitiendo evento emitRetransmision']);

	var originalTxId = dbTx._id;
	var estadoOriginal = dbTx.status;
	var estadoNuevo = rtxResult && rtxResult.status ? rtxResult.status : null;

	var retransmissionData = {
		_id: rtxId,
		timestamp: new Date(),
		status: rtxStatus,
		options: options
	}
	if (errorMessage) retransmissionData.errorMessage = errorMessage;
	if (options.ctxId) retransmissionData.cloned = true;
	if (!options.ctxId && rtxResult) retransmissionData.newValues = rtxResult;

	var updateQuery = {
		$setOnInsert: {
			_id: originalTxId
		},
		$push: {
			retransmissions: retransmissionData
		}
	}


	if (options.ctxId) {
		// La retransmisión ha generado un clon.
		module.exports.emitFinClonarPedido(originalTxId, options.ctxId, rtxResult)
		Flags.set(originalTxId, K.FLAGS.CLONADO);
	}
	else if (!options.noActualizarOriginal && rtxResult) {
		// ¿Debemos actualizar la transmisión original?
		var [actualizar, advertencia] = actualizarTransmisionOriginal(estadoOriginal, estadoNuevo);
		if (actualizar) {
			updateQuery['$set'] = {modifiedAt: new Date()};
			retransmissionData.oldValues = {};

			for(var campo in rtxResult) {
				updateQuery['$set'][campo] = rtxResult[campo];
				retransmissionData.oldValues[campo] = dbTx[campo];
			}

			if (advertencia) {
				Flags.set(originalTxId, K.FLAGS.RETRANSMISION_UPDATE_WARN);
				L.xw(originalTxId, ['** ADVERTENCIA: La respuesta del pedido que se dió a la farmacia ha cambiado']);
			} else {
				Flags.set(originalTxId, K.FLAGS.RETRANSMISION_UPDATE);
			}
		} else {
			// Si se habían establecido flags, las borramos, pues no queremos actualizar nada
			// mas que añadir el flag de retransmision sin update
			Flags.del(originalTxId);
			Flags.set(originalTxId, K.FLAGS.RETRANSMISION_NO_UPDATE);
		}

	} else {
		Flags.set(originalTxId, K.FLAGS.RETRANSMISION_NO_UPDATE);
	}

	
	Flags.finaliza(originalTxId, updateQuery);

	Imongo.commit(updateQuery);
	L.xi(originalTxId, ['Emitiendo COMMIT para evento Retransmit', L.saneaCommit(updateQuery)], 'txCommit');
	L.yell(originalTxId, K.TX_TYPES.RETRANSMISION_PEDIDO, estadoNuevo, [rtxResult]);
}

/**
 * Esta funcion nos ayuda a decidir si la retransmisión debe actualizar la transmisión original.
 * Se basa en la tabla definida en el manual:
 * 		https://fedicom3-app.hefame.es/documentacion/manual/retransmit
 * @param {number} estadoOriginal El estado original de la transmisión
 * @param {number} estadoNuevo El estado resultante de la retransmisión
 */
const actualizarTransmisionOriginal = (estadoOriginal, estadoNuevo) => {
	if (!estadoNuevo) return [false, false];
	if (!estadoOriginal) return [true, false];

	// Los estados RECEPCIONADO, ESPERANDO_INCIDENCIAS o INCIDENCIAS_RECIBIDAS siempre se actualizan.
	switch (estadoOriginal) {
		case K.TX_STATUS.RECEPCIONADO:
		case K.TX_STATUS.ESPERANDO_INCIDENCIAS:
		case K.TX_STATUS.INCIDENCIAS_RECIBIDAS:
			return [true, false];
	}

	// Si el estado nuevo es NO_SAP, nunca actualizamos
	if (estadoNuevo === K.TX_STATUS.NO_SAP) return [false, false];

	// Si el estado original es OK, solo actualizamos si el nuevo estado tambien lo es
	if (estadoOriginal === K.TX_STATUS.OK) return [estadoNuevo === K.TX_STATUS.OK, false];

	// En el resto de casos, siempre actualizaremos, pero puede que haya que advertir
	switch (estadoNuevo) {
		case K.TX_STATUS.OK:
		case K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO:
			return [true, false];
	}
	switch (estadoOriginal) {
		case K.TX_STATUS.PETICION_INCORRECTA:
		case K.TX_STATUS.PEDIDO.RECHAZADO_SAP:
			return [true, false];
	}
	return [true, (estadoNuevo === K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP && estadoNuevo === estadoOriginal)];
};



module.exports.emitInicioClonarPedido = (clonReq, pedido, otxId) => {
	let ctxId = clonReq.txId;

	var reqData = {
		$setOnInsert: {
			_id: ctxId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.RECEPCIONADO
		},
		$set: {
			
			crc: new ObjectID(pedido.crc),
			authenticatingUser: clonReq.identificarUsuarioAutenticado(),
			client: clonReq.identificarClienteSap(),
			iid: global.instanceID,
			type: K.TX_TYPES.PEDIDO,
			clientRequest: {
				authentication: clonReq.token,
				ip: 'RTX',
				headers: clonReq.headers,
				body: clonReq.body
			},
		}
	};

	Flags.set(ctxId, K.FLAGS.CLON);
	Flags.finaliza(ctxId, reqData);

	L.xi(clonReq.txId, ['Emitiendo COMMIT para evento InicioClonarPedido'], 'txCommit');
	Imongo.commit(reqData);
	L.yell(clonReq.txId, K.TX_TYPES.PEDIDO, K.TX_STATUS.RECEPCIONADO, [clonReq.identificarUsuarioAutenticado(), pedido.crc, clonReq.body]);
}

module.exports.emitFinClonarPedido = (oTxId, ctxId, rtxResult) => {

	var resData = {
		$setOnInsert: {
			_id: ctxId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
		},
		$set: {
			...rtxResult,
			originalTxId: new ObjectID(oTxId)
		}
	}

	Flags.finaliza(ctxId, resData);

	L.xi(ctxId, ['Emitiendo COMMIT para evento FinClonarPedido'], 'txCommit');
	Imongo.commit(resData);
	L.yell(ctxId, K.TX_TYPES.PEDIDO, rtxResult.status, [rtxResult]);
}


module.exports.emitStatusFix = (txId, newStatus) => {

	if (txId) {
		var dataUpdate = {
			$setOnInsert: {
				_id: txId,
				createdAt: new Date()
			},
			$max: {
				status: newStatus,
				modifiedAt: new Date()
			}
		};

		//Flags.set(txId, K.FLAGS.WATCHDOG);
		Flags.finaliza(txId, dataUpdate);

		L.xi(txId, ['Emitiendo COMMIT para evento StatusFix', L.saneaCommit(dataUpdate)], 'txCommit');
		Imongo.commit(dataUpdate);
		L.yell(txId, K.TX_TYPES.ARREGLO_ESTADO, newStatus, ['StatusFix']);
	}
}


module.exports.emitRecoverConfirmacionPedido = (originalTxId, confirmTx) => {

	var confirmacionSap = confirmTx.clientRequest.body;
	var confirmId = confirmTx._id;

	var [estadoTransmision, numerosPedidoSAP] = ConfirmacionPedidoSAP.obtenerEstadoDeConfirmacionSap(confirmacionSap);

	var updateData = {
		$setOnInsert: {
			_id: originalTxId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: estadoTransmision,
		},
		$set: {
			numerosPedidoSAP: numerosPedidoSAP
		},
		$push:{
			sapConfirms: {
				txId: confirmId,
				timestamp: confirmId.createdAt,
				sapSystem: confirmTx.authenticatingUser
			}
		}
	}

	//Flags.set(originalTxId, K.FLAGS.WATCHDOG);
	Flags.finaliza(originalTxId, updateData);

	L.xi(originalTxId, ['Emitiendo COMMIT para evento RecoverConfirmacionPedido', L.saneaCommit(updateData)], 'txCommit');
	Imongo.commit(updateData);
	L.yell(originalTxId, K.TX_TYPES.RECUPERACION_CONFIRMACION, estadoTransmision, numerosPedidoSAP);

	/**
	 * Dejamos constancia en la propia transmisión de confirmación de que se ha actualizado
	 * Lo normal es que previamente estuviera en estado K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO
	 * y no tenga el valor de 'confirmingId'
	 */
	var commitConfirmacionSap = {
		$setOnInsert: {
			_id: confirmId,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.OK,
			confirmingId: originalTxId,
		}
	}
	L.xi(confirmId, ['Se ha asociado esta confirmación con la transmisión del pedido con ID ' + originalTxId, L.saneaCommit(commitConfirmacionSap)], 'txCommit');
	Imongo.commit(commitConfirmacionSap);

}
