'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Interfaces
const iSap = require('interfaces/isap/iSap');
const iMongo = require('interfaces/imongo/iMongo');
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('global/tokens');
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const PedidoCliente = require('modelos/pedido/ModeloPedidoCliente');
const PedidoSap = require('modelos/pedido/ModeloPedidoSap');
const { default: axios } = require('axios');
const CRC = require('modelos/CRC');



// POST /pedido
exports.crearPedido = async function (req, res) {
	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como ENTRADA DE PEDIDO']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, simulacionRequiereSolicitudAutenticacion: true });
	if (!estadoToken.ok) {
		iEventos.pedidos.errorPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let pedidoCliente = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		pedidoCliente = new PedidoCliente(req);
	} catch (excepcion) {
		// La generación del objeto puede causar una excepción si la petición no era correcta.
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xw(txId, ['Ocurrió un error al analizar la petición', errorFedicom])
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res, 400);
		iEventos.pedidos.errorPedido(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Añade flag de lista negra
	if (pedidoCliente.metadatos.clienteListaNegra) {
		iFlags.set(txId, C.flags.CLIENTE_LISTA_NEGRA)
	}

	// Si la transmisión no contiene ningúna línea válida, no se hace nada mas con esta.
	if (!pedidoCliente.contieneLineasValidas()) {
		L.xw(txId, ['Todas las lineas contienen errores, se responden las incidencias sin llamar a SAP']);
		let cuerpoRespuesta = pedidoCliente.generarRespuestaDeTodasLasLineasSonInvalidas();
		res.status(400).json(cuerpoRespuesta);
		iEventos.pedidos.errorPedido(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xi(txId, ['El contenido de la transmisión es un pedido correcto']);


	// Control de duplicados
	try {
		let txOriginal = await iMongo.consultaTx.duplicadoDeCRC(txId, pedidoCliente);
		let txIdOriginal = txOriginal._id;

		if (txIdOriginal) {
			L.xi(txId, ['Detectada la transmisión de pedido con idéntico CRC', txIdOriginal], 'crc');
			L.xi(txIdOriginal, 'Se ha recibido una transmisión duplicada de este pedido con ID ' + txId, 'crc');

			if (txOriginal.status === K.TX_STATUS.RECHAZADO_SAP) {
				L.xi(txId, ['La transmisión original fue rechazada por SAP, no la tomamos como repetida', txIdOriginal.status]);
				iFlags.set(txId, C.flags.REINTENTO_CLIENTE, txIdOriginal._id);
			} else {
				let cuerpoRespuesta = txOriginal.clientResponse?.body
				if (!cuerpoRespuesta || Array.isArray(cuerpoRespuesta)) {
					let errorFedicom = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado: ' + pedidoCliente.crc, 400);
					cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				}

				// Adaptación del cuerpo de respuesta para ocultar que es un duplicado
				if (pedidoCliente.metadatos.clienteListaNegra) {

					cuerpoRespuesta.fechaPedido = Date.toFedicomDateTime();
					cuerpoRespuesta.numeroPedido = CRC.generar(cuerpoRespuesta.fechaPedido);
					cuerpoRespuesta.numeroPedidoOrigen = pedidoCliente.numeroPedidoOrigen;
					if (Array.isArray(cuerpoRespuesta.lineas)) {
						cuerpoRespuesta.lineas.forEach(linea => {
							linea.cantidadFalta = linea.cantidad;
							if (!Array.isArray(linea.incidencias) || !linea.incidencias.length) {
								linea.incidencias = [
									{
										codigo: "LIN-PED-WARN-002",
										descripcion: "SERVICIO PARCIAL"
									}
								];
							}
						});
					}
					res.status(201).send(cuerpoRespuesta)

				} else {
					let errorFedicom = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado: ' + pedidoCliente.crc, 400);
					cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				}

				iEventos.pedidos.pedidoDuplicado(req, res, cuerpoRespuesta, txIdOriginal);
				return;
			}

		} else {
			L.xt(txId, ['No se ha detectado pedido duplicado'], 'crc');
		}
	} catch (errorMongo) {
		L.xe(txId, ['Ocurrió un error al comprobar si el pedido es duplicado - Se asume que no lo es', errorMongo], 'crc');
	}



	iEventos.pedidos.inicioPedido(req, pedidoCliente);

	try {

		let cuerpoRespuestaSap = await iSap.pedidos.realizarPedido(pedidoCliente);

		// Si la respuesta de SAP es un array de incidencias
		if (Array.isArray(cuerpoRespuestaSap)) {

			L.xw(txId, ['SAP devuelve un cuerpo de respuesta que es un array con errores de rechazo', cuerpoRespuestaSap]);
			// Eliminamos las incidencias cuyo código comienza por 'SAP-IGN', ya que dan información sobre el bloqueo del cliente
			// y no queremos que esta información se mande al clietne.
			let bloqueoCliente = false;
			let incidenciasSaneadas = cuerpoRespuestaSap.filter((incidencia) => {
				bloqueoCliente = Boolean(incidencia?.codigo?.startsWith('SAP-IGN'));
				return !bloqueoCliente && Boolean(incidencia);
			});

			// Si el cliente está bloqueado, agregamos la incidencia de error de bloqueo en SAP y levantamos el Flag
			if (bloqueoCliente) {
				L.xw(txId, ['SAP indica que el cliente tiene bloqueos de pedidos']);
				iFlags.set(txId, C.flags.BLOQUEO_CLIENTE)
				incidenciasSaneadas.push({
					codigo: K.INCIDENCIA_FEDICOM.ERR_PED,
					descripcion: 'No se pudo guardar el pedido. Contacte con su comercial.'
				});
			}

			res.status(409).json(incidenciasSaneadas);
			iEventos.pedidos.finPedido(res, incidenciasSaneadas, K.TX_STATUS.RECHAZADO_SAP);
			return;
		}


		// Lo primero, vamos a comprobar que SAP nos haya devuelto un objeto con las faltas del pedido. 
		// En ocasiones la conexión peta y la respuesta no puede recuperarse, por lo que tratamos este caso como que SAP está caído.
		if (!cuerpoRespuestaSap || !cuerpoRespuestaSap.crc) {
			L.xe(txId, ['SAP devuelve un cuerpo de respuesta que no es un objeto válido. Se devuelve error de faltas simuladas', cuerpoRespuestaSap]);
			let respuestaFaltasSimuladas = pedidoCliente.gererarRespuestaFaltasSimuladas();
			res.status(202).json(respuestaFaltasSimuladas);
			iFlags.set(txId, C.flags.NO_SAP);
			iFlags.set(txId, C.flags.NO_FALTAS);
			iEventos.pedidos.finPedido(res, respuestaFaltasSimuladas, K.TX_STATUS.NO_SAP);
			return;
		}




		// Si la respuesta de SAP es un Objeto, lo procesamos y mandamos las faltas al cliente
		let pedidoSap = new PedidoSap(cuerpoRespuestaSap, pedidoCliente, txId);
		if (pedidoSap.metadatos.pedidoDuplicadoSap) {
			L.xd(txId, ["SAP indica pedido duplicado, se responde incidencia al cliente"]);
			let errorFedicom = new ErrorFedicom('PED-ERR-008', 'Pedido duplicado: ' + pedidoCliente.crc, 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.pedidos.pedidoDuplicado(req, res, cuerpoRespuesta, txIdOriginal);
			return;
		}

		let respuestaCliente = pedidoSap.generarJSON();

		res.status(201).json(respuestaCliente);
		iEventos.pedidos.finPedido(res, respuestaCliente, pedidoSap.getEstadoTransmision(), {
			numeroPedidoAgrupado: pedidoSap.getNumeroPedidoAgrupado(),
			numerosPedidoSAP: pedidoSap.getNumerosPedidoSap()
		});

		// Añadimos información adicional si el pedido es de F+Online

		if (C.datosAdicionalesFmas.activo && pedidoCliente.login.domain === C.dominios.FMASONLINE) {
			respuestaCliente.numerosPedidoSap.forEach(async numPedSap => {
				try {
					let respuesta = await axios({
						url: C.datosAdicionalesFmas.url,
						method: "POST",
						data: {
							ZDATOS_ADIC: {
								MANDT: "020",
								VBELN: String(numPedSap),
								NUM_PED_WEB: pedidoCliente.numeroPedidoOrigen.substring(0, 20),
								NOMBRE_CLI: (pedidoCliente.nombreConsumidorFinal || "").substring(0, 120)
							}
						}
					})
					L.xd(txId, ["Insertados datos de pedidos adicionales para el pedido", numPedSap, respuesta.data]);
				} catch (error) {
					L.xw(txId, ["Error al insertar datos adicionales del pedido en SAP:", error.message]);
				}
			});
		}


	} catch (errorLlamadaSap) {

		L.xe(txId, ['Incidencia en la comunicación con SAP - Se simulan las faltas del pedido', errorLlamadaSap]);
		let respuestaFaltasSimuladas = pedidoCliente.gererarRespuestaFaltasSimuladas();
		res.status(202).json(respuestaFaltasSimuladas);
		iFlags.set(txId, C.flags.NO_SAP);
		iFlags.set(txId, C.flags.NO_FALTAS);
		iEventos.pedidos.finPedido(res, respuestaFaltasSimuladas, K.TX_STATUS.NO_SAP);

	}

}

// GET /pedido
// GET /pedido/:numeroPedido
exports.consultaPedido = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como CONSULTA DE PEDIDO']);

	// Comprobación del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { admitirSimulaciones: true, admitirSimulacionesEnProduccion: true });
	if (!estadoToken.ok) {
		iEventos.consultas.consultaPedido(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	let numeroPedido = (req.params ? req.params.numeroPedido : null) || (req.query ? req.query.numeroPedido : null);

	if (!M.ObjectID.isValid(numeroPedido)) {
		L.xe(txId, ['El numero de pedido indicado no es un ObjectID válido', numeroPedido]);
		let errorFedicom = new ErrorFedicom('PED-ERR-005', 'El parámetro "numeroPedido" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.PETICION_INCORRECTA);
		return;
	}

	try {
		let dbTx = await iMongo.consultaTx.porCRC(numeroPedido)
		L.xi(txId, ['Se ha recuperado el pedido de la base de datos']);

		if (dbTx?.clientResponse) {
			let cuerpoRespuestaOriginal = dbTx.clientResponse.body;
			res.status(200).json(cuerpoRespuestaOriginal);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuestaOriginal, K.TX_STATUS.OK);
		} else {
			let errorFedicom = new ErrorFedicom('PED-ERR-001', 'El pedido solicitado no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE);
		}
	} catch (errorMongo) {
		L.xe(txId, ['No se ha podido recuperar el pedido', errorMongo]);
		let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_PED, 'Ocurrió un error al recuperar el pedido', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaPedido(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_DB);
		return;
	}


}

// PUT /pedido
exports.actualizarPedido = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como ACTUALIZACIÓN DE PEDIDO']);

	let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_PED, 'No se ha implementado el servicio de actualización de pedidos', 501);
	let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
	iEventos.descartar(req, res, cuerpoRespuesta);
	L.xw(txId, [errorFedicom]);

}