'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iEventos = require('interfaces/eventos/iEventos');
const iTokens = require('global/tokens');
//const iSap = require('interfaces/isap/iSap');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


const enviarErrorFacturaNoImplementada = (res) => {
	let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_FACT, 'No se ha implementado el servicio de consulta de facturas', 501);
	let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
	L.xw(res.txId, ['Devolvemos error de que la factura no está implementada', cuerpoRespuesta]);
	return cuerpoRespuesta;
}


// GET /facturas/:numeroFactura
const consultaFactura = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Procesando transmisión como CONSULTA DE FACTURA']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res, {
		admitirSimulaciones: true,
		admitirSimulacionesEnProduccion: true
	});
	if (!estadoToken.ok) {
		iEventos.consultas.consultaFactura(req, res, estadoToken.respuesta, estadoToken.motivo, null, null);
		return;
	}

	// Saneado del número de la factura
	let numFactura = req.params.numeroFactura;
	if (!numFactura) {
		let errorFedicom = new ErrorFedicom('FACT-ERR-003', 'El parámetro "numeroFactura" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaFactura(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, null, null);
		return;
	}
	let numFacturaSaneado = numFactura.padStart(10, '0');
	L.xi(txId, ['El número de factura solicitado', numFacturaSaneado])

	// Detección del formato solicitado
	let formatoFactura;

	if (req.headers['accept']) {
		switch (req.headers['accept'].toLowerCase()) {
			case 'application/pdf': formatoFactura = 'PDF'; break;
			case 'application/xml': formatoFactura = 'XML'; break;
			default: formatoFactura = 'JSON'; break;
		}
	}

	L.xi(txId, ['Se determina el formato solicitado de la factura', formatoFactura, req.headers['accept']]);

	///////////////////
	let cuerpoRespuesta = enviarErrorFacturaNoImplementada(res);
	iEventos.consultas.consultaFactura(req, res, cuerpoRespuesta, K.TX_STATUS.OK, numFacturaSaneado, formatoFactura);
	return;
	///////////////////

	/*
	switch (formatoFactura) {
		case 'JSON':
			_consultaFacturaJSON(req, res, numFacturaSaneado);
			return;
		case 'PDF':
			_consultaFacturaPDF(req, res, numFacturaSaneado);
			return;
		case 'XML':
			_consultaFacturaXML(req, res, numFacturaSaneado);
			return;
		default:
			// Nunca vamos a llegar a este caso, pero aquí queda el tratamiento necesario por si acaso
			let errorFedicom = new ErrorFedicom(K.INCIDENCIA_FEDICOM.ERR_FACT, 'No se reconoce del formato de albarán en la cabecera "Accept"', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			//iEventos.consultas.consultaFactura(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA, numFacturaSaneado, null);
			return;
	}
	*/
}


// GET /factura
const listadoFacturas = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Procesando transmisión como LISTADO DE FACTURAS']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res, {
		admitirSimulaciones: true,
		admitirSimulacionesEnProduccion: true
	});
	if (!estadoToken.ok) {
		iEventos.consultas.consultaListadoFacturas(req, res, estadoToken.respuesta, estadoToken.motivo);
		return;
	}


	// En el caso de que se busque por un numeroFactura concreto hacemos la búsqueda de esa factura JSON concreta
	// usando el método de obtener un único albarán en JSON
	if (req.query.numeroFactura) {
		// let numFactura = req.query.numeroFactura.padStart(10, '0');
		// _consultaFacturaJSON(req, res, numAlbaran, true /*Responder en un array*/);
		let cuerpoRespuesta = enviarErrorFacturaNoImplementada(res);
		iEventos.consultas.consultaListadoFacturas(req, res, cuerpoRespuesta, K.TX_STATUS.OK);
		return;
	}


	// #1 - Saneado del código del cliente
	let codigoCliente = req.query.codigoCliente
	if (!codigoCliente) {
		let errorFedicom = new ErrorFedicom('FACT-ERR-002', 'El "codigoCliente" es inválido.', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoFacturas(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// Si el código de cliente está en formato corto, vamos a utilizar el código de login
	// aprovechando que la búsqueda se realiza entre todos los códigos del mismo cliente.
	if (codigoCliente.length < 8 && req.token.sub && req.token.sub.includes('@')) {
		// Nos quedamos con la parte que va delante de la arroba.
		codigoCliente = req.token.sub.split('@')[0];
		L.xi(txId, ['Detectado codigo de cliente corto. Se usa el usuario del token como codigo de cliente', codigoCliente]);
	}
	codigoCliente = codigoCliente.padStart(10, '0');


	// #2 - Limpieza de offset y limit
	let limit = parseInt(req.query.limit) || 50;
	if (limit > 50 || limit <= 0) {
		let errorFedicom = new ErrorFedicom('FACT-ERR-009', 'El campo "limit" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoFacturas(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	let offset = parseInt(req.query.offset) || 0;
	if (offset < 0) {
		let errorFedicom = new ErrorFedicom('FACT-ERR-008', 'El campo "offset" es inválido', 400);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.consultas.consultaListadoFacturas(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}

	// En el caso de que se busque por un numeroAlbaran, lo rellenamos con 0 a la izquierda
	let numeroAlbaranSaneado;
	if (req.query.numeroAlbaran) {
		numeroAlbaranSaneado = req.query.numeroAlbaran.padStart(10, '0');
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
			let errorFedicom = new ErrorFedicom('FACT-ERR-010', 'El intervalo entre el parámetro "fechaDesde" y "fechaHasta" no puede ser superior a un año', 400);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.consultas.consultaListadoFacturas(req, res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
			return;
		}
	}

	let cuerpoRespuesta = enviarErrorFacturaNoImplementada(res);
	iEventos.consultas.consultaListadoFacturas(req, res, cuerpoRespuesta, K.TX_STATUS.OK);
	return;
}


module.exports = {
	consultaFactura,
	listadoFacturas
}