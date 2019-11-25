'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const Imongo = require(BASE + 'interfaces/imongo');
const ConfirmacionPedidoSAP = require(BASE + 'model/pedido/confirmacionPedidoSAP');


module.exports.emitRetransmision = (rtxId, dbTx, options, rtxStatus, errorMessage, rtxResult) => {
	L.xd(rtxId, ['Emitiendo evento emitRetransmision']);

	var originalTxId = dbTx._id;
	var estadoOriginal = dbTx.status;
	var estadoNuevo = rtxResult && rtxResult.status ? rtxResult.status : null;

	var retransmissionData = {
		_id: rtxId,
		timestamp: new Date(),
		status: rtxStatus,
		options: options,
		errorMessage: errorMessage ? errorMessage : undefined,
		newValues: rtxResult
	}

	var updateQuery = {
		$setOnInsert: {
			_id: originalTxId
		},
		$push: {
			retransmissions: retransmissionData
		}
	}


	// ¿DEBEMOS ACTUALIZAR LA TRANSMISION ORIGINAL?
	if (!options.noActualizarOriginal && rtxResult) {

		var [actualizar, advertencia] = actualizarTransmisionOriginal(estadoOriginal, estadoNuevo);

		if (actualizar) {
			updateQuery['$set'] = {modifiedAt: new Date()};
			retransmissionData.oldValues = {};

			for(var campo in rtxResult) {
				updateQuery['$set'][campo] = rtxResult[campo];
				retransmissionData.oldValues[campo] = dbTx[campo];
			}
		}
		if (advertencia) {
			L.xw(originalTxId, ['** ADVERTENCIA: La respuesta del pedido que se dió a la farmacia ha cambiado']);
		}
	}

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
	if (estadoNuevo === K.TX_STATUS.PEDIDO.NO_SAP) return [false, false];

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

		L.xi(txId, ['Emitiendo COMMIT para evento StatusFix', L.saneaCommit(dataUpdate)], 'txCommit');
		Imongo.commit(dataUpdate);
		L.yell(txId, K.TX_TYPES.ARREGLO_ESTADO, newStatus, ['StatusFix']);
	}
}


module.exports.emitRecoverConfirmacionPedido = (originalTx, confirmTx) => {

	var confirmacionSap = confirmTx.clientRequest.body;
	var txId = originalTx._id;
	var confirmId = confirmTx._id;

	var [estadoTransmision, numerosPedidoSAP] = ConfirmacionPedidoSAP.obtenerEstadoDeConfirmacionSap(confirmacionSap);

	var updateData = {
		$setOnInsert: {
			_id: txId,
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

	L.xi(txId, ['Emitiendo COMMIT para evento RecoverConfirmacionPedido', L.saneaCommit(updateData)], 'txCommit');
	Imongo.commit(updateData);
	L.yell(txId, K.TX_TYPES.RECUPERACION_CONFIRMACION, estadoTransmision, numerosPedidoSAP);

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
			confirmingId: txId,
		}
	}
	L.xi(confirmId, ['Se ha asociado esta confirmación con la transmisión del pedido con ID ' + txId, L.saneaCommit(commitConfirmacionSap)], 'txCommit');
	Imongo.commit(commitConfirmacionSap);

}
