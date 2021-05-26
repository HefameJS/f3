'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces

const iTokens = require('global/tokens');

const iFlags = require('interfaces/iflags/iFlags');
const iEventos = require('interfaces/eventos/iEventos');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const SolicitudAutenticacion = require('modelos/autenticacion/SolicitudAutenticacion');


// POST /authenticate
const autenticar = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, 'Procesando petición de autenticación');
	iEventos.autenticacion.inicioAutenticacion(req);

	let solicitudAutenticacion = null;
	try {
		solicitudAutenticacion = new SolicitudAutenticacion(req);
	} catch (excepcion) {
		let errorFedicom = new ErrorFedicom(excepcion);
		L.xw(txId, ['Ocurrió un error al analizar la petición', errorFedicom]);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res, 400);
		iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, K.TX_STATUS.PETICION_INCORRECTA);
		return;
	}



	let resultado = await solicitudAutenticacion.validarCredenciales();
	/*
	resultado:
		tokenGenerado: true | false
		respuesta: JSON de respuesta con el token o ErrorFedicom
		codigoEstado: estado HTTP para la respuesta
		estadoTransmision: estado de la transmisión
	*/

	let cuerpoRespuesta = resultado.respuesta;

	if (!resultado.tokenGenerado) {
		cuerpoRespuesta = resultado.respuesta.enviarRespuestaDeError(res);
	} else {
		res.status(resultado.codigoEstado).json(cuerpoRespuesta);
	}

	iFlags.autenticacion.generaFlags(solicitudAutenticacion);
	iEventos.autenticacion.finAutenticacion(res, cuerpoRespuesta, resultado.estadoTransmision);

}

// GET /authenticate
const verificarToken = async function (req, res) {

	if (req.token) {
		let tokenData = iTokens.verificarToken(req.token);
		res.status(200).send({ token: req.token, token_data: tokenData });
	} else {
		let tokenData = { meta: { ok: false, error: 'No se incluye token' } };
		res.status(200).send({ token: req.token, token_data: tokenData });
	}

}



module.exports = {
	autenticar,
	verificarToken
}