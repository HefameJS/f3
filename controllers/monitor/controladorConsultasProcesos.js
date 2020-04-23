'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iRegistroProcesos = require('interfaces/procesos/iRegistroProcesos')

// GET /status/proc
const consultaProcesos = (req, res) => {
	let txId = req.txId;

	L.xi(txId, ['Consulta de procesos']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let tipoProceso = req.query.type ? req.query.type : null;
	let host = req.query.host ? req.query.host : null;


	iRegistroProcesos.consultaProcesos(tipoProceso, host, (errorRegistroProcesos, procesos) => {
		if (errorRegistroProcesos) {
			L.xe(txId, ['Error al obtener la lista de procesos', errorRegistroProcesos]);
			res.status(500).json({ ok: false, error: (errorRegistroProcesos.error || errorRegistroProcesos.message) });
			return;
		}
		L.xi(txId, ['Obtenida lista de procesos']);
		res.status(200).json({ ok: true, data: procesos });
		return;

	} )

	
}


module.exports = {
	consultaProcesos // GET /status/proc
}
