'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const IRegistroProcesos = require(BASE + 'interfaces/procesos/iRegistroProcesos')

// GET /status/proc
const consultaProcesos = function (req, res) {
	var txId = req.txId;

	L.xi(txId, ['Consulta de procesos']);

	// Verificación del token del usuario
	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	var procType = req.query.type ? req.query.type : null;
	var host = req.query.host ? req.query.host : null;


	IRegistroProcesos.consultaProcesos(procType, host, (err, procesos) => {
		if (err) {
			L.xe(txId, ['Error al obtener la lista de procesos', err]);
			res.status(500).json({ ok: false, error: (err.error || err.message) });
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
