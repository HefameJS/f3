'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('global/tokens');
const iSap = require('interfaces/isap/iSap');

// Modelos
const CRC = require('modelos/CRC');
const ErrorFedicom = require('modelos/ErrorFedicom');
const ConsultaAlbaran = require('modelos/albaran/ModeloConsultaAlbaran');
const Albaran = require('modelos/albaran/ModeloAlbaran');
const ConfirmacionAlbaran = require('modelos/albaran/ModeloConfirmacionAlbaran');



const _consultaAlbaranPDF = async function (req, res, numAlbaran) {

	let txId = req.txId;

	try {
		let cuerpoSap = await iSap.albaranes.consultaAlbaranPDF(numAlbaran, txId);

		if (cuerpoSap && Array.isArray(cuerpoSap) && cuerpoSap.length > 0) {
			if (cuerpoSap[0].pdf_file) {
				L.xi(txId, ['Se obtuvo el albarán PDF en Base64 desde SAP']);
				let buffer = Buffer.from(cuerpoSap[0].pdf_file, 'base64');

				res.setHeader('Content-Type', 'application/pdf');
				res.setHeader('Content-Disposition', 'attachment; filename=' + numAlbaran + '.pdf');
				res.status(200).send(buffer);
				iEventos.consultas.consultaAlbaran(req, res, { pdf: numAlbaran, bytes: buffer.length }, K.TX_STATUS.OK, numAlbaran, 'PDF');
				return;
			}
			// Si el PDF no existe, SAP genera un error de la forma
			//[{"id":2,"message":"No se ha encontrado el documento indicado"}]]
			else if (cuerpoSap[0].id === 2 && cuerpoSap[0].message === 'No se ha encontrado el documento indicado') {
				L.xw(txId, ['SAP ha mandado el mensaje de que el albarán no existe', cuerpoSap]);
				let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'No se encontró el albarán', 404);
				let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
				iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, numAlbaran, 'PDF');
				return;
			}
		}

		L.xe(txId, ['Ocurrió un error al solicitar el albarán PDF a SAP', cuerpoSap]);
		let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_ALB, 'Ocurrió un error en la búsqueda del albarán', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.ERROR_RESPUESTA_SAP, numAlbaran, 'PDF');
		return;

	} catch (errorSap) {
		L.xe(txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán PDF', errorSap]);
		let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_ALB, 'Ocurrió un error en la búsqueda del albarán', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP, numAlbaran, 'PDF');
		return;
	}

}

const _consultaAlbaranJSON = async function (req, res, numAlbaran, devolverComoArray) {
	let txId = req.txId;

	try {
		let codigoClienteAutenticado = req.token.sub;
		let cuerpoSap = await iSap.albaranes.consultaAlbaranJSON(numAlbaran, codigoClienteAutenticado, txId);

		// Comprobamos que SAP haya devuelto al menos un objeto con el campo de posiciones
		if (cuerpoSap?.t_pos) {
			let datosAlbaran = new Albaran(cuerpoSap);
			if (devolverComoArray) datosAlbaran = [datosAlbaran];
			res.status(200).json(datosAlbaran);
			iEventos.consultas.consultaAlbaran(req, res, { json: numAlbaran }, K.TX_STATUS.OK, numAlbaran, 'JSON');
		} else {
			L.xw(txId, ["SAP no ha devuelto albaranes", cuerpoSap]);
			let errorFedicom = new ErrorFedicom('ALB-ERR-001', 'El albarán solicitado no existe', 404);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.CONSULTA.NO_EXISTE, numAlbaran, 'JSON');
		}

	} catch (errorSap) {

		L.xe(txId, ['Ocurrió un error en la comunicación con SAP mientras se consultaba el albarán JSON', errorSap]);
		let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'Ocurrió un error en la búsqueda del albarán', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP, numAlbaran, 'JSON');
		return;
	}

}

// GET /albaranes/:numeroAlbaran
const consultaAlbaran = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CONSULTA DE ALBARAN']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res, {
		admitirSimulaciones: true,
		admitirSimulacionesEnProduccion: true
	});
	if (!estadoToken.ok) {
		iEventos.consultas.consultaAlbaran(req, res, estadoToken.respuesta, estadoToken.motivo, null, null);
		return;
	}


	// Saneado del número del albarán
	let numAlbaran = req.params.numeroAlbaran;
	if (!numAlbaran) {
		let errorFedicom = new ErrorFedicom('ALB-ERR-003', 'El parámetro "numeroAlbaran" es obligatorio', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, null, null);
		return;
	}
	let numAlbaranSaneado = numAlbaran.padStart(10, '0');
	L.xi(txId, ['El número de albarán solicitado', numAlbaranSaneado])


	// Detección del formato solicitado
	let formatoAlbaran;

	if (req.headers['accept']) {
		switch (req.headers['accept'].toLowerCase()) {
			case 'application/pdf': formatoAlbaran = 'PDF'; break;
			default: formatoAlbaran = 'JSON'; break;
		}
	}

	L.xi(txId, ['Se determina el formato solicitado del albarán', formatoAlbaran, req.headers['accept']]);

	switch (formatoAlbaran) {
		case 'JSON':
			return _consultaAlbaranJSON(req, res, numAlbaranSaneado);
		case 'PDF':
			return _consultaAlbaranPDF(req, res, numAlbaranSaneado);
		default:
			// Nunca vamos a llegar a este caso, pero aquí queda el tratamiento necesario por si acaso
			let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_ALB, 'No se reconoce del formato de albarán en la cabecera "Accept"', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, numAlbaranSaneado, null);
			return;
	}

}


// GET /albaranes
const listadoAlbaranes = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como LISTADO DE ALBARANES']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res, {
		admitirSimulaciones: true,
		admitirSimulacionesEnProduccion: true
	});
	if (!estadoToken.ok) {
		iEventos.consultas.consultaListadoAlbaranes(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	// En el caso de que se busque por un numeroAlbaran concreto hacemos la búsqueda de ese albaran JSON concreto
	// usando el método de obtener un único albarán en JSON
	if (req.query.numeroAlbaran) {
		let numAlbaran = req.query.numeroAlbaran.padStart(10, '0');
		_consultaAlbaranJSON(req, res, numAlbaran, true /*Responder en un array*/);
		return;
	}


	// #1 - Saneado del código del cliente
	let codigoCliente = req.query.codigoCliente
	if (!codigoCliente) {
		let errorFedicom = new ErrorFedicom('ALB-ERR-002', 'El "codigoCliente" es inválido.', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoAlbaranes(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Si el código de cliente está en formato corto, vamos a utilizar el código de login
	// aprovechando que la búsqueda se realiza entre todos los códigos del mismo cliente.
	if (codigoCliente.length < 8 && req.token.sub ) {
		let codigoClienteLargo = '0';
		// Casos en donde el usuario es de la forma xxxxxxxx@hefame
		if (req.token.sub.includes('@')) {
			// Nos quedamos con la parte que va delante de la arroba.
			codigoClienteLargo = req.token.sub.split('@')[0];
		}
		// Casos de usuarios Borgino que son de la forma BF02901xxxxx
		else if (req.token.sub.startsWith('BF')) {
			// Eliminamos el BF y nos quedamos con el resto
			codigoClienteLargo = req.token.sub.slice(2);
		}

		codigoCliente = codigoClienteLargo;
	
	} 

	codigoCliente = codigoCliente.padStart(10, '0');


	// #2 - Limpieza de offset y limit
	let limit = parseInt(req.query.limit) || 50;
	if (limit > 50 || limit <= 0) {
		let errorFedicom = new ErrorFedicom('ALB-ERR-008', 'El campo "limit" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoAlbaranes(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	let offset = parseInt(req.query.offset) || 0;
	if (offset < 0) {
		let errorFedicom = new ErrorFedicom('ALB-ERR-007', 'El campo "offset" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoAlbaranes(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}


	// #3 - Limpieza de Fechas
	// Si viene fechaAlbaran, esta manda sobre el resto.
	// De lo contrario, se usa fechaDesde/fechaHasta. Si alguno no aparece, se establece a la fecha actual.
	let fechaAlbaran = Date.fromFedicomDate(req.query.fechaAlbaran);
	let fechaDesde, fechaHasta;
	if (fechaAlbaran) {
		fechaDesde = fechaHasta = fechaAlbaran;
	} else {

		// Si no se especifica la fechaHasta, se establece la fecha máxima el momento actual.
		fechaHasta = Date.fromFedicomDate(req.query.fechaHasta) || new Date();
		// Si no se especifica la fechaDesde, se establece a un año atrás, desde la fechaHasta.
		// TODO: Este campo debería cambiarse para buscar desde el inicio del día
		fechaDesde = Date.fromFedicomDate(req.query.fechaDesde) || new Date(new Date(fechaHasta).setFullYear(fechaHasta.getFullYear() - 1));

		// Si hay que invertir las fechas...
		if (fechaDesde.getTime() > fechaHasta.getTime()) {
			let tmp = fechaDesde;
			fechaDesde = fechaHasta;
			fechaHasta = tmp;
		}

		// Comprobación de rango inferior a 1 año
		// TODO: Hacer configurable
		let diff = (fechaHasta.getTime() - fechaDesde.getTime()) / 1000;
		if (diff > 31622400) { // 366 dias * 24h * 60m * 60s
			fechaHasta = new Date();
			fechaDesde = new Date(new Date(fechaHasta).setMonth(fechaHasta.getMonth() - 1));
			return;
		}
	}

	// Instanciamos el objeto con la consulta
	let consultaSap = new ConsultaAlbaran(codigoCliente)
	consultaSap.setLimit(limit)
		.setOffset(offset)
		.setFechas(fechaDesde, fechaHasta);


	// #4 - Se filtra filtra por numeroPedidoOrigen
	let numeroPedidoOrigen = req.query.numeroPedidoOrigen;
	if (numeroPedidoOrigen) {
		// El codigo de cliente con el que se crean los pedidos es el corto, por lo que deberemos
		// convertir el que nos viene a corto para generar el mismo CRC
		// TODO: Esto solo funciona con pedidos que generen el CRC con el numeroPedidoOrigen y no con las lineas...
		// Habría que buscar en Mongo el CRC de este numero y si hacemos esto, pues ya la búsqueda la hacemos
		// sobre los números de pedido de SAP (sería lo suyo en verdad)...
		// OTRA OPCION: Es que se busque en SAP los que sean de la forma 'numeroPedidoOrigen*' pero esto puede ser mortal...
		let codigoClienteOrigen = parseInt(codigoCliente.slice(-5));
		let crc = CRC.crear(codigoClienteOrigen, numeroPedidoOrigen);
		consultaSap.setNumeroPedidoOrigen(numeroPedidoOrigen, crc);
	}

	// #5 - El cliente filtra por numeroPedido (de distribuidor)
	// En este caso, nos pasan el CRC del pedido
	// TODO: Sería viable consultar en Mongo por los números de pedido SAP para este CRC y consultar a SAP directamente con
	// estos valores...
	let numeroPedido = req.query.numeroPedido;
	if (numeroPedido) {
		consultaSap.setCrc(numeroPedido)
	}

	L.xd(txId, ['Buscando en SAP albaranes con filtro', consultaSap.toQueryString()]);

	try {
		let cuerpoSap = await iSap.albaranes.listadoAlbaranes(consultaSap, txId);
		if (cuerpoSap?.tot_rec >= 0 && Array.isArray(cuerpoSap.t_data)) {
			L.xi(txId, ["SAP ha devuelto albaranes", cuerpoSap.t_data.length]);
			let albaranesJson = cuerpoSap.t_data.map(albaranSap => new Albaran(albaranSap));

			res.setHeader('X-Total-Count', cuerpoSap.tot_rec);
			res.status(200).send(albaranesJson);
			iEventos.consultas.consultaListadoAlbaranes(req, res, null, K.TX_STATUS.OK, {
				consultaSap,
				numeroResultadosTotales: cuerpoSap.tot_rec,
				numeroResultadosEnviados: albaranesJson.length
			});
		} else {
			L.xw(txId, ["SAP no ha devuelto albaranes", cuerpoSap])
			res.setHeader('X-Total-Count', 0);
			res.status(200).json([]);
			iEventos.consultas.consultaListadoAlbaranes(req, res, null, K.TX_STATUS.CONSULTA.NO_EXISTE, {
				consultaSap,
				numeroResultadosTotales: 0,
				numeroResultadosEnviados: 0
			});
		}
	} catch (errorSap) {
		L.xe(txId, ['Ocurrió un error al buscar albaranes en SAP', errorSap]);
		let errorFedicom = new ErrorFedicom('ALB-ERR-999', 'Ocurrió un error en la búsqueda de albaranes', 500);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoAlbaranes(req, res, cuerpoRespuesta, K.TX_STATUS.ERROR_RESPUESTA_SAP, { consultaSap });
		return;
	}

}

// POST /albaranes/confirmacion
const confirmacionAlbaran = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CONFIRMACION DE ALBARAN']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res, {
		admitirSimulaciones: true,
		simulacionRequiereSolicitudAutenticacion: true
	});
	if (!estadoToken.ok) {
		iEventos.confirmacionAlbaran.confirmarAlbaran(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}

	let confirmacionAlbaran = null;
	L.xd(txId, ['Analizando el contenido de la transmisión']);
	try {
		confirmacionAlbaran = new ConfirmacionAlbaran(req);
	} catch (excepcion) {
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xw(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.confirmacionAlbaran.confirmarAlbaran(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	L.xd(txId, ['El contenido de la transmisión es una solicitud de confirmacion de albarán correcta', confirmacionAlbaran]);
	let cuerpoRespuestaCliente = confirmacionAlbaran.generarJSON();
	res.status(200).json(cuerpoRespuestaCliente);
	iEventos.confirmacionAlbaran.confirmarAlbaran(req, res, cuerpoRespuestaCliente, K.TX_STATUS.OK, { albaranConfirmado: confirmacionAlbaran.numeroAlbaran });

}

module.exports = {
	consultaAlbaran,
	listadoAlbaranes,
	confirmacionAlbaran
}