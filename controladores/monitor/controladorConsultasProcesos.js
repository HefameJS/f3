'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externas
const OS = require('os');

// Interfaces
const iTokens = require('global/tokens');
const iRegistroProcesos = require('interfaces/procesos/iRegistroProcesos')

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


// GET /procesos ? [servidor=<host-proceso>] & [tipo=<tipo-proceso>]
const listadoProcesos = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Consulta de procesos']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	let tipoProceso = req.query.tipo ? req.query.tipo : null;
	let servidor = req.query.servidor ? req.query.servidor : null;

	if (servidor === 'local') {
		servidor = OS.hostname();
	}

	iRegistroProcesos.consultaProcesos(tipoProceso, servidor, (errorRegistroProcesos, procesos) => {
		if (errorRegistroProcesos) {
			L.xe(txId, ['Error al obtener la lista de procesos', errorRegistroProcesos]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de procesos');
			return;
		}
		L.xi(txId, ['Obtenida lista de procesos']);
		res.status(200).json(procesos);
		return;

	})


}



module.exports = {
	listadoProcesos
}
