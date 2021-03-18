'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('global/tokens');
const iSap = require('interfaces/isap/iSap');
const iMonitor = require('interfaces/iMonitor');

// Modelos
const DestinoSap = require('modelos/DestinoSap');
const ErrorFedicom = require('modelos/ErrorFedicom');



// GET /sap/conexion ? [nombreSistemaSap=<nombreSistema>] & [servidor=local]
const pruebaConexion = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la comunicación con SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = req.query.nombreSistemaSap || C.sap.nombreSistemaPorDefecto;

	if (req.query.servidor === 'local') {

		try {
			let estaConectado = await iSap.ping(nombreSistemaSap);
			let respuesta = { nombreSistema: nombreSistemaSap, disponible: estaConectado || false }
			res.status(200).json(respuesta);
		}
		catch (errorSap) {
			res.status(500).json(errorSap);
		}
	}
	else {

		try {
			let respuestasRemotas = await iMonitor.llamadaTodosMonitores('/v1/sap/conexion?nombreSistemaSap=' + (nombreSistemaSap || '') + '&servidor=local');
			res.status(200).send(respuestasRemotas);
		} catch (errorLlamada) {
			L.xe(txId, ['Ocurrió un error al obtener el estado de la conexión a SAP', errorLlamada]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el estado de la conexión a SAP');
			return;
		}

	}
}

// GET /sap/sistemas
const consultaSistemas = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de los sistemas SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let resupuesta = C.sap.destinos.map( destino => destino.describirSistema() )
	res.status(200).json(resupuesta);
}


// GET /sap/sistemas/:nombreSistema
const consultaSistema = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de sistema SAP', req.params.nombreSistema]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = req.params.nombreSistema;

	if (nombreSistemaSap === 'default') {
		nombreSistemaSap = C.sap.nombreSistemaPorDefecto;
	}

	let sistemaSap = C.sap.getSistema(nombreSistemaSap);

	if (sistemaSap) {
		res.status(200).json(sistemaSap.describirSistema());
	} else {
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se encuentra el sistema SAP');
	}

}

module.exports = {
	pruebaConexion,
	consultaSistemas,
	consultaSistema
}