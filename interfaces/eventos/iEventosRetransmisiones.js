'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iFlags = require('interfaces/iFlags');

// Modelos
const ObjectID = iMongo.ObjectID;
const ConfirmacionPedidoSAP = require('modelos/pedido/ModeloConfirmacionPedidoSAP');



module.exports.retransmitirPedido = (txIdRetransmision, dbTx, opcionesRetransmision, estadoRetransmision, mensajeError, resultadoRetransmision) => {

	L.xd(txIdRetransmision, ['Emitiendo evento retransmitirPedido']);

	let txIdOriginal = dbTx._id;
	let estadoOriginal = dbTx.status;
	let estadoNuevo = resultadoRetransmision && resultadoRetransmision.status ? resultadoRetransmision.status : null;

	let datosRetransmitidos = {
		_id: txIdRetransmision,
		timestamp: new Date(),
		status: estadoRetransmision,
		options: opcionesRetransmision
	}
	if (mensajeError) datosRetransmitidos.errorMessage = mensajeError;
	if (opcionesRetransmision.ctxId) datosRetransmitidos.cloned = true;
	if (!opcionesRetransmision.ctxId && resultadoRetransmision) datosRetransmitidos.newValues = resultadoRetransmision;

	let transaccionDeActualizacion = {
		$setOnInsert: {
			_id: txIdOriginal
		},
		$push: {
			retransmissions: datosRetransmitidos
		}
	}


	if (opcionesRetransmision.ctxId) {
		// La retransmisión ha generado un clon del pedido, lo actualizamos con los datos del resultado
		module.exports.finClonarPedido(txIdOriginal, opcionesRetransmision.ctxId, resultadoRetransmision);

		// Marcamos la transmisión original como que ha sido clonada
		iFlags.set(txIdOriginal, C.flags.CLONADO);
	}
	else if (!opcionesRetransmision.noActualizarOriginal && resultadoRetransmision) {
		// ¿Debemos actualizar la transmisión original?
		let [actualizar, advertencia] = _actualizarTransmisionOriginal(estadoOriginal, estadoNuevo);
		if (actualizar) {
			transaccionDeActualizacion['$set'] = { modifiedAt: new Date() };
			datosRetransmitidos.oldValues = {};

			for (let campo in resultadoRetransmision) {
				transaccionDeActualizacion['$set'][campo] = resultadoRetransmision[campo];
				datosRetransmitidos.oldValues[campo] = dbTx[campo];
			}

			if (advertencia) {
				iFlags.set(txIdOriginal, C.flags.RETRANSMISION_UPDATE_WARN);
				L.xw(txIdOriginal, ['** ADVERTENCIA: La respuesta del pedido que se dió a la farmacia ha cambiado']);
			} else {
				iFlags.set(txIdOriginal, C.flags.RETRANSMISION_UPDATE);
			}
		} else {
			// Si se habían establecido flags, las borramos, pues no queremos actualizar nada
			// mas que añadir el flag de retransmision sin update
			iFlags.del(txIdOriginal);
			iFlags.set(txIdOriginal, C.flags.RETRANSMISION_NO_UPDATE);
		}

	} else {
		iFlags.set(txIdOriginal, C.flags.RETRANSMISION_NO_UPDATE);
	}


	iFlags.finaliza(txIdOriginal, transaccionDeActualizacion);

	iMongo.transaccion.grabar(transaccionDeActualizacion);
	L.xi(txIdOriginal, ['Emitiendo COMMIT para evento Retransmision'], 'txCommit');
	L.evento(txIdOriginal, K.TX_TYPES.RETRANSMISION_PEDIDO, estadoNuevo, [resultadoRetransmision]);
}

/**
 * Esta funcion nos ayuda a decidir si la retransmisión debe actualizar la transmisión original.
 * Se basa en la tabla definida en el manual:
 * 		https://fedicom3-app.hefame.es/documentacion/manual/retransmit
 * @param {number} estadoOriginal El estado original de la transmisión
 * @param {number} estadoNuevo El estado resultante de la retransmisión
 */
const _actualizarTransmisionOriginal = (estadoOriginal, estadoNuevo) => {
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
		case K.TX_STATUS.RECHAZADO_SAP:
			return [true, false];
	}
	return [true, (estadoNuevo === K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP && estadoNuevo === estadoOriginal)];
};


/**
 * Este evento crea la transccion como RECEPCIONADA con el flag 'CLON'
 * La posterior emisión de iEventos.retransmisiones.retransmitirPedido es la que completará
 * el estado de la misma con la respuesta de SAP y la nueva respuesta del cliente.
 */
module.exports.inicioClonarPedido = (reqClonada, pedidoClonado) => {

	let txId = reqClonada.txId;

	let transaccion = {
		$setOnInsert: {
			_id: txId,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.RECEPCIONADO
		},
		$set: {
			crc: new ObjectID(pedidoClonado.crc),
			authenticatingUser: reqClonada.identificarUsuarioAutenticado(),
			client: reqClonada.identificarClienteSap(),
			iid: global.instanceID,
			type: K.TX_TYPES.PEDIDO,
			clientRequest: {
				authentication: reqClonada.token,
				ip: 'RTX',
				headers: reqClonada.headers,
				body: reqClonada.body
			},
		}
	};

	iFlags.set(txId, C.flags.CLON);
	iFlags.finaliza(txId, transaccion);

	L.xi(reqClonada.txId, ['Emitiendo COMMIT para evento InicioClonarPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(reqClonada.txId, K.TX_TYPES.PEDIDO, K.TX_STATUS.RECEPCIONADO, [reqClonada.identificarUsuarioAutenticado(), pedidoClonado.crc, reqClonada.body]);
}


module.exports.finClonarPedido = (txIdOriginal, txIdClonado, resultadoRetransmision) => {

	let transaccion = {
		$setOnInsert: {
			_id: txIdClonado,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
		},
		$set: {
			...resultadoRetransmision,
			originalTxId: new ObjectID(txIdOriginal)
		}
	}

	iFlags.finaliza(txIdClonado, transaccion);

	L.xi(txIdClonado, ['Emitiendo COMMIT para evento FinClonarPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txIdClonado, K.TX_TYPES.PEDIDO, resultadoRetransmision.status, [resultadoRetransmision]);
}

module.exports.cambioEstado = (txId, nuevoEstado) => {

	if (txId) {
		let transaccion = {
			$setOnInsert: {
				_id: txId,
				createdAt: new Date()
			},
			$max: {
				status: nuevoEstado,
				modifiedAt: new Date()
			}
		};

		//Flags.set(txId, C.flags.WATCHDOG);
		iFlags.finaliza(txId, transaccion);

		L.xi(txId, ['Emitiendo COMMIT para evento StatusFix'], 'txCommit');
		iMongo.transaccion.grabar(transaccion);
		L.evento(txId, K.TX_TYPES.ARREGLO_ESTADO, nuevoEstado, ['StatusFix']);
	}
}

module.exports.asociarConfirmacionConPedido = (txIdConfirmada, dbTxConfirmacionSap) => {

	let cuerpoConfirmacionSap = dbTxConfirmacionSap.clientRequest.body;
	let txIdConfirmacionSap = dbTxConfirmacionSap._id;
	let confirmacionPedidoSAP = new ConfirmacionPedidoSAP({ txId: txIdConfirmacionSap, body: cuerpoConfirmacionSap });

	let transaccion = {
		$setOnInsert: {
			_id: txIdConfirmada,
			createdAt: new Date()
		},
		$max: {
			modifiedAt: new Date(),
			status: confirmacionPedidoSAP.estadoTransmision,
		},
		$set: {
			numerosPedidoSAP: confirmacionPedidoSAP.pedidosAsociadosSap
		},
		$push: {
			sapConfirms: {
				txId: txIdConfirmacionSap,
				timestamp: txIdConfirmacionSap.createdAt,
				sapSystem: dbTxConfirmacionSap.authenticatingUser
			}
		}
	}

	iFlags.finaliza(txIdConfirmada, transaccion);

	L.xi(txIdConfirmada, ['Emitiendo COMMIT para evento asociarConfirmacionConPedido'], 'txCommit');
	iMongo.transaccion.grabar(transaccion);
	L.evento(txIdConfirmada, K.TX_TYPES.RECUPERACION_CONFIRMACION, confirmacionPedidoSAP.estadoTransmision, confirmacionPedidoSAP.pedidosAsociadosSap);

	/**
	 * Dejamos constancia en la propia transmisión de confirmación de que se ha actualizado
	 * Lo normal es que previamente estuviera en estado K.TX_STATUS.CONFIRMACION_PEDIDO.NO_ASOCIADA_A_PEDIDO
	 * y no tenga el valor establecido 'confirmingId'
	 */
	let transaccionConfirmacionSap = {
		$setOnInsert: {
			_id: txIdConfirmacionSap,
			createdAt: new Date()
		},
		$set: {
			modifiedAt: new Date(),
			status: K.TX_STATUS.OK,
			confirmingId: txIdConfirmada,
		}
	}
	L.xi(txIdConfirmacionSap, ['Se ha asociado esta confirmación con el pedido que confirma', txIdConfirmada], 'txCommit');
	iMongo.transaccion.grabar(transaccionConfirmacionSap);

}
