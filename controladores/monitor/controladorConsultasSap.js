'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iSap = require('interfaces/isap/iSap');
const iMonitor = require('interfaces/ifedicom/iMonitor');

// Modelos
const DestinoSap = require('modelos/DestinoSap');
const ErrorFedicom = require('modelos/ErrorFedicom');

// GET /sap/conexion ? [nombreSistemaSap=<nombreSistema>]
const pruebaConexion = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la comunicación con SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = (req.query ? req.query.nombreSistemaSap : null) || C.sap_systems.default;

	if (req.query.servidor === 'local') {

		iSap.ping(nombreSistemaSap, (errorSap, estaConectado, urlDestino) => {
			if (!errorSap) {
				res.status(200).json({ nombreSistema: nombreSistemaSap, disponible: estaConectado || false, destino: urlDestino });
			} else {
				res.status(200).json({ disponible: estaConectado || false, error: errorSap.code });
			}
		});

	}
	else {

		iMonitor.realizarLlamadaMultiple(req.query.servidor, '/v1/sap/conexion?nombreSistemaSap=' + (nombreSistemaSap || '') + '&servidor=local', (errorLlamada, respuestasRemotas) => {
			if (errorLlamada) {
				L.xe(txId, ['Ocurrió un error al obtener el estado de la conexión a SAP', errorLlamada]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el estado de la conexión a SAP');
				return;
			}
			res.status(200).send(respuestasRemotas);
		})

	}
}

// GET /sap/sistemas
const consultaSistemas = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de los sistemas SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	if (req.query.servidor === 'local') {

		let sistemasSap = []
		for (let nombreSistema in C.sap_systems) {
			if (nombreSistema === 'default') continue;

			let sistemaSap = new DestinoSap(C.sap_systems[nombreSistema], nombreSistema);

			sistemasSap.push(sistemaSap.describirSistema());
		}
		res.status(200).json(sistemasSap);

	} else {

		iMonitor.realizarLlamadaMultiple(req.query.servidor, '/v1/sap/sistemas?servidor=local', (errorLlamada, respuestasRemotas) => {
			if (errorLlamada) {
				L.xe(txId, ['Ocurrió un error al obtener el listado de sistemas SAP', errorLlamada]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el listado de sistemas SAP');
				return;
			}
			res.status(200).send(respuestasRemotas);
		})

	}

}


// GET /sap/sistemas/:nombreSistema
const consultaSistema = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de sistema SAP', req.params.nombreSistema]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = req.params.nombreSistema;

	if (req.query.servidor === 'local') {

		if (nombreSistemaSap === 'default') {
			nombreSistemaSap = C.sap_systems.default;
			L.xi(txId, ['Se sustituye el nombre de sistema "default" por el nombre del sistema por defecto', nombreSistemaSap]);
		}
		let sistemaSap = DestinoSap.desdeNombre(nombreSistemaSap);
		if (sistemaSap) {
			res.status(200).json(sistemaSap.describirSistema());
		} else {
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se encuentra el sistema SAP');
		}

	} else {

		iMonitor.realizarLlamadaMultiple(req.query.servidor, '/v1/sap/sistemas/' + nombreSistemaSap + '?servidor=local', (errorLlamada, respuestasRemotas) => {
			if (errorLlamada) {
				L.xe(txId, ['Ocurrió un error al obtener el listado de sistemas SAP', errorLlamada]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener el listado de sistemas SAP');
				return;
			}
			res.status(200).send(respuestasRemotas);
		})

	}
}

module.exports = {
	pruebaConexion,
	consultaSistemas,
	consultaSistema
}