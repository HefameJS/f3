'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externas
const clone = require('clone');

// Interfaces
const iTokens = require('util/tokens');
const iSap = require('interfaces/isap/iSap');

// Modelos
const DestinoSap = require('model/ModeloDestinoSap');

// GET /sap/conexion ? [nombreSistemaSap=<nombreSistema>]
const pruebaConexion = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta del estado de la comunicación con SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = (req.query ? req.query.nombreSistemaSap : null) || C.sap_systems.default;

	iSap.ping(nombreSistemaSap, (errorSap, estaConectado, urlDestino) => {
		if (!errorSap) {
			res.status(200).json({ ok: true, data: { nombreSistema: nombreSistemaSap, disponible: estaConectado || false, destino: urlDestino } });
		} else {
			res.status(200).json({ ok: true, data: { disponible: estaConectado || false, error: errorSap.code } });
		}
	});
}

// GET /sap/sistemas
const consultaSistemas = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de los sistemas SAP']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let sistemasSap = []

	for (let nombreSistema in C.sap_systems) {
		if (nombreSistema === 'default') continue;

		let sistemaSap = new DestinoSap(C.sap_systems[nombreSistema], nombreSistema);

		sistemasSap.push(sistemaSap.describirSistema());
	}

	res.status(200).json({ ok: true, data: sistemasSap });

}


// GET /sap/sistemas/:nombreSistema
const consultaSistema = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de sistema SAP', req.params.nombreSistema]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let nombreSistemaSap = req.params.nombreSistema;

	if (nombreSistemaSap === 'default') {
		nombreSistemaSap = C.sap_systems.default;
		L.xi(txId, ['Se sustituye el nombre de sistema "default" por el nombre del sistema por defecto', nombreSistemaSap]);
	}

	let sistemaSap = DestinoSap.desdeNombre(nombreSistemaSap);

	if (sistemaSap) 
		res.status(200).json({ ok: true, data: sistemaSap.describirSistema() });
	else 
		res.status(200).json({ ok: false, error: 'No se encuentra el sistema SAP' });

}

module.exports = {
	pruebaConexion,
	consultaSistemas,
	consultaSistema
}