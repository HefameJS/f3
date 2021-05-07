'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('global/tokens');
const iSap = require('interfaces/isap/iSap');
const iMonitor = require('interfaces/iMonitor');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');



// GET /sap/conexion ? [servidor=local]
exports.pruebaConexion = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la comunicación con SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;
	if (req.query.servidor === 'local') {

		try {
			let estaConectado = await iSap.ping();
			let respuesta = { disponible: estaConectado || false }
			res.status(200).json(respuesta);
		}
		catch (errorSap) {
			res.status(500).json(errorSap);
		}
	}
	else {

		try {
			let respuestasRemotas = await iMonitor.llamadaTodosMonitores('/v1/sap/conexion?servidor=local');
			res.status(200).send(respuestasRemotas);
		} catch (errorLlamada) {
			L.xe(txId, ['Ocurrió un error al obtener el estado de la conexión a SAP', errorLlamada]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el estado de la conexión a SAP');
			return;
		}

	}
}


// GET /sap/destino
exports.consultaDestino = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta del destino SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	res.status(200).json(C.sap.destino.describirSistema());

}
