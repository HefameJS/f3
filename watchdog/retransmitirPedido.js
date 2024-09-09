'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iSap = require('interfaces/isap/iSap');
const iEventos = require('interfaces/eventos/iEventos');
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const PedidoCliente = require('modelos/pedido/ModeloPedidoCliente');
const PedidoSap = require('modelos/pedido/ModeloPedidoSap');

// Helpers
const extensionesExpress = require('global/extensiones/extensionesExpress');


const estadosRetransmitibles = [
	K.TX_STATUS.RECEPCIONADO,
	K.TX_STATUS.ESPERANDO_INCIDENCIAS,
	K.TX_STATUS.INCIDENCIAS_RECIBIDAS,
	K.TX_STATUS.NO_SAP
];

const estadosRetransmitiblesForzando = [
	K.TX_STATUS.OK,
	K.TX_STATUS.PETICION_INCORRECTA,
	K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO,
	K.TX_STATUS.RECHAZADO_SAP,
	K.TX_STATUS.PEDIDO.ESPERA_AGOTADA,
	K.TX_STATUS.PEDIDO.SIN_NUMERO_PEDIDO_SAP,
	K.TX_STATUS.MAX_RETRANSMISIONES
];

/**
 * Retransmite un pedido.
 * 
 * @param {string} txId El ID de transmisión del pedido a retransmitir
 * @param {object} opcionesRetransmision Opciones de la retransmisión
 */
const retransmitirPedido = async function (txIdOriginal, opcionesRetransmision) {
	if (!opcionesRetransmision) opcionesRetransmision = {};

	opcionesRetransmision.force = opcionesRetransmision.force ? opcionesRetransmision.force : false;
	opcionesRetransmision.regenerateCRC = opcionesRetransmision.regenerateCRC ? opcionesRetransmision.regenerateCRC : false;
	opcionesRetransmision.forzarAlmacen = opcionesRetransmision.forzarAlmacen ? opcionesRetransmision.forzarAlmacen : undefined;
	opcionesRetransmision.noActualizarOriginal = opcionesRetransmision.noActualizarOriginal ? opcionesRetransmision.noActualizarOriginal : false;

	let txIdRetransmision = new M.ObjectID();

	L.xi(txIdRetransmision, ['Retransmisión de pedido con ID ' + txIdOriginal, opcionesRetransmision]);

	let dbTx;
	try {
		dbTx = await iMongo.consultaTx.porId(txIdOriginal)
		if (!dbTx) {
			L.xe(txIdRetransmision, ['No se encontró la transmisión en la base de datos']);
			throw new Error('No se encontró la transmisión en la base de datos');
		}
	} catch (errorMongo) {
		L.xe(txIdRetransmision, ['Ocurrió un error al buscar la transmisión en la base de datos', errorMongo]);
		throw new Error('Ocurrió un error al buscar la transmisión en la base de datos');
	}

	// Escribimos en el log de la transmisión original, ahora que sabemos que existe:
	L.xi(txIdOriginal, ['Se lanza la retransmisión con ID ' + txIdRetransmision + ' para esta transmisión']);

	// La transmisión a retransmitir no es un pedido
	if (dbTx.type !== K.TX_TYPES.PEDIDO) {
		let mensajeDeError = 'La transmisión indicada no es un pedido';
		L.xe(txIdRetransmision, [mensajeDeError, dbTx.type]);
		L.xw(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con errores', mensajeDeError]);
		return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, mensajeDeError)
	}
	L.xt(txIdRetransmision, ['OK: La transmisión es de tipo CREAR PEDIDO']);

	// Comprobamos que tenemos toda la información de la petición original necesaria. 
	if (!dbTx.clientRequest || !dbTx.clientRequest.body || !dbTx.clientRequest.authentication) {
		let mensajeDeError = 'La transmisión no tiene guardada toda la transmisión HTTP original necesaria';
		L.xf(txIdRetransmision, [mensajeDeError, dbTx]);
		L.xe(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con errores', mensajeDeError]);
		return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, mensajeDeError)

	}
	L.xt(txIdRetransmision, ['OK: Tenemos todos los campos necesarios para la retransmisión']);

	let [esRetransmisible, estadoError, mensajeDeError] = _esRetransmisible(dbTx, opcionesRetransmision.force);
	if (!esRetransmisible) {
		L.xe(txIdRetransmision, [mensajeDeError, estadoError, dbTx.status]);
		L.xe(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con errores', mensajeDeError]);
		return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, estadoError, mensajeDeError)
	}
	L.xt(txIdRetransmision, ['OK: La transmisión es válida para ser retransmitida']);

	// Recreamos el pedido, tal y como vendría en la petición original
	// Es decir, hacemos pasar 'dbTx.clientRequest' por la variable 'req' original.
	// Para esto, necesitaremos que existan los campos 'body', 'txId' y 'token'
	let pedidoCliente = null;
	try {
		dbTx.clientRequest.txId = dbTx._id;
		dbTx.clientRequest.token = dbTx.clientRequest.authentication;
		let opciones = {
			fechaRecepcion: dbTx.createdAt
		};

		pedidoCliente = new PedidoCliente(dbTx.clientRequest, opciones);
	} catch (excepcion) {
		let fedicomError = new ErrorFedicom(excepcion);
		L.xe(txIdRetransmision, ['Ocurrió un error al analizar la petición', fedicomError])

		L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza en estado de PETICION INCORRECTA']);
		return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
			clientResponse: _construyeRespuestaCliente(txIdOriginal, 400, fedicomError.getErrores()),
			status: K.TX_STATUS.PETICION_INCORRECTA
		});
	}
	L.xt(txIdRetransmision, ['OK: El contenido de la transmisión es un pedido correcto', pedidoCliente]);


	if (opcionesRetransmision.forzarAlmacen) {
		L.xd(txIdRetransmision, ['Se fuerza el cambio del almacén del pedido [' + (pedidoCliente.codigoAlmacenServicio || '<n/a>') + '] => [' + opcionesRetransmision.forzarAlmacen + ']']);
		pedidoCliente.codigoAlmacenServicio = opcionesRetransmision.forzarAlmacen;
		pedidoCliente.metadatos.fechaRecepcion = new Date();
		// Si cambia el sistema SAP, forzamos la regeneración del CRC y por tanto la creación de una transmisión nueva
		opcionesRetransmision.regenerateCRC = true;
	}

	let txIdNuevo = null;
	if (opcionesRetransmision.regenerateCRC) {
		L.xd(txIdRetransmision, ['Se fuerza la regeneración aleatoria del NumeroPedidoOrigen y CRC del pedido.']);
		pedidoCliente.inventarCRC();
		pedidoCliente.metadatos.fechaRecepcion = new Date();

		// Si cambia el CRC, nunca actualizaremos el pedido original sino que generaremos
		// una nueva transmisión con su propio TxId
		opcionesRetransmision.noActualizarOriginal = true;

		// Creamos un clon de la request y lo emitimos como un nuevo inicio de pedido
		let req = extensionesExpress.extenderSolicitudRetransmision(dbTx.clientRequest);

		// Además del nuevo numeroPedidoOrigen, si se ha establecido un almacen nuevo y/o un sistema SAP nuevo, 
		// debemos tambien cambiarlo en el cuerpo de la petición.
		req.body.numeroPedidoOrigen = pedidoCliente.numeroPedidoOrigen;
		if (pedidoCliente.codigoAlmacenServicio) req.body.codigoAlmacenServicio = pedidoCliente.codigoAlmacenServicio;

		txIdNuevo = req.txId;
		opcionesRetransmision.ctxId = txIdNuevo;

		L.xi(txIdRetransmision, ['La retransmisión resultará en la generación de una nueva transmisión con TxID [' + txIdNuevo + ']']);
		L.xi(txIdOriginal, ['Se ha generado un clon de la transmisión con ID [' + txIdNuevo + ']']);
		L.xi(txIdNuevo, ['Se inicia esta transmisión como clon de [' + txIdOriginal + '], generado por la retransmisión [' + txIdRetransmision + ']']);

		// Este evento crea la transccion como RECEPCIONADA.
		// La posterior emisión de iEventos.retransmisiones.retransmitirPedido es la que completará
		// el estado de la misma con la respuesta de SAP y la nueva respuesta del cliente mediante la
		// llamada a finClonarPedido.
		iEventos.retransmisiones.inicioClonarPedido(req, pedidoCliente);
	}


	L.xi(txIdRetransmision, ['Transmitimos a SAP el pedido']);

	try {
		let respuestaSap = await iSap.pedidos.retransmitirPedido(pedidoCliente, true);
		let peticionASap = respuestaSap.peticion;
		respuestaSap = _construyeRespuestaSap(respuestaSap);
		let cuerpoRespuestaSap = respuestaSap.body;

		// Si la respuesta de SAP es un array ...
		if (Array.isArray(cuerpoRespuestaSap)) {
			// Eliminamos las incidencias cuyo código comienza por 'SAP-IGN', ya que dan información sobre el bloqueo del cliente
			// y no queremos que esta información se mande al clietne.
			let bloqueoCliente = false;
			let incidenciasSaneadas = cuerpoRespuestaSap.filter((incidencia) => {
				bloqueoCliente = Boolean(incidencia?.codigo?.startsWith('SAP-IGN'));
				return !bloqueoCliente && Boolean(incidencia);
			});

			// Si el cliente está bloqueado, agregamos la incidencia de error de bloqueo en SAP y levantamos el Flag
			if (bloqueoCliente) {
				L.xw(txIdRetransmision, ['SAP indica que el cliente tiene bloqueos de pedidos']);
				iFlags.set(txIdRetransmision, C.flags.BLOQUEO_CLIENTE)
				incidenciasSaneadas = incidenciasSaneadas.push({
					codigo: K.INCIDENCIA_FEDICOM.ERR_PED,
					descripcion: 'No se pudo guardar el pedido. Contacte con su comercial.'
				});
			}

			let respuestaCliente = _construyeRespuestaCliente(txIdNuevo || txIdOriginal, 409, incidenciasSaneadas)

			return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
				sapRequest: peticionASap,
				sapResponse: respuestaSap,
				clientResponse: respuestaCliente,
				status: K.TX_STATUS.RECHAZADO_SAP
			});

		} // +RETURN

		// Vamos a comprobar que SAP nos haya devuelto un objeto con las faltas del pedido. En ocasiones la conexión peta y la respuesta no 
		// puede recuperarse, por lo que tratamos este caso como que SAP está caído.
		if (!cuerpoRespuestaSap || !cuerpoRespuestaSap.crc) {
			L.xe(txIdRetransmision, ['SAP devuelve un cuerpo de respuesta que no es un objeto válido. Se devuelve error de faltas simuladas', cuerpoRespuestaSap]);
			let respuestaFaltasSimuladas = pedidoCliente.gererarRespuestaFaltasSimuladas();

			L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con éxito']);
			return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
				sapRequest: peticionASap,
				sapResponse: respuestaSap,
				clientResponse: _construyeRespuestaCliente(txIdNuevo || txIdOriginal, 201, respuestaFaltasSimuladas),
				status: K.TX_STATUS.NO_SAP
			});

		} // +RETURN

		// Si la respuesta de SAP es un Objeto, lo procesamos y mandamos las faltas al cliente
		let pedidoSap = new PedidoSap(cuerpoRespuestaSap, pedidoCliente.crc, txIdNuevo || txIdOriginal);
		L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con éxito']);

		return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
			sapRequest: peticionASap,
			sapResponse: respuestaSap,
			clientResponse: _construyeRespuestaCliente(txIdNuevo || txIdOriginal, 201, pedidoSap.generarJSON()),
			status: pedidoSap.getEstadoTransmision(),
			numerosPedidoSAP: pedidoSap.getNumerosPedidoSap(),
			numeroPedidoAgrupado: pedidoSap.getNumeroPedidoAgrupado()
		});

	} catch (errorLlamadaSap) {

		let peticionASap = errorLlamadaSap.peticion;
		delete errorLlamadaSap.peticion;

		L.xe(txIdRetransmision, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', errorLlamadaSap]);
		let respuestaFaltasSimuladas = pedidoCliente.gererarRespuestaFaltasSimuladas();
		L.xi(txIdOriginal, ['La retransmisión con ID ' + txIdRetransmision + ' finaliza con éxito']);
		L.xi(txIdRetransmision, ['Finaliza la retransmisión']);

		return iEventos.retransmisiones.retransmitirPedido(txIdRetransmision, dbTx, opcionesRetransmision, K.TX_STATUS.RETRANSMISION.OK, null, {
			sapRequest: peticionASap,
			sapResponse: errorLlamadaSap,
			clientResponse: _construyeRespuestaCliente(txIdNuevo || txIdOriginal, 201, respuestaFaltasSimuladas),
			status: K.TX_STATUS.NO_SAP
		});

	}

}



/**
 * Construye el campo 'sapResponse' de la transmisión para almacenarlo en MongoDB
 * @param {*} errorSap 
 * @param {*} respuestaSap 
 */
const _construyeRespuestaSap = (respuestaSap) => {

	return {
		timestamp: new Date(),
		statusCode: respuestaSap.status,
		headers: respuestaSap.headers,
		body: respuestaSap.data
	}

}

const _construyeRespuestaCliente = (txId, codigoEstadoHttp, cuerpoRespuesta) => {
	return {
		timestamp: new Date(),
		statusCode: codigoEstadoHttp,
		headers: {
			'x-txid': txId,
			'software-id': C.softwareId.servidor,
			'content-api-version': K.VERSION.PROTOCOLO,
			'content-type': 'application/json; charset=utf-8',
			'content-length': cuerpoRespuesta ? '' + cuerpoRespuesta.length : '0'
		},
		body: cuerpoRespuesta
	};
}

const _esRetransmisible = (dbTx, forzar) => {

	if (estadosRetransmitibles.includes(dbTx.status))
		return [true, null, 'El estado de la transmisión es válido para ser retransmitido'];

	if (estadosRetransmitiblesForzando.includes(dbTx.status)) {
		if (forzar)
			return [true, null, 'El estado de la transmisión es válido para ser retransmitido porque se está forzando'];
		else
			return [false, K.TX_STATUS.RETRANSMISION.SOLO_FORZANDO, 'El estado de la retransmisión solo permite retransmitirla forzando'];
	}

	return [false, K.TX_STATUS.RETRANSMISION.IMPOSIBLE, 'El estado de la transmisión no admite retransmitirla en ningún caso'];
}


module.exports = {
	retransmitirPedido
};