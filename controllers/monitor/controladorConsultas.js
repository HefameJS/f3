'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iMongo = require('interfaces/imongo/iMongo');


// PUT /query
const consultaTransmisiones = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	
	let query = req.body;

	iMongo.consultaTx.consultaOld(txId, query, (err, resultado) => {
		if (err) {
			res.status(500).json({ ok: false, error: (err.error || err.message) });
			return;
		}
		res.status(200).json({ ok: true, ...resultado });
	});

}

module.exports = {
	consultaTransmisiones,
	transmisiones: require('controllers/monitor/controladorConsultasTransmisiones'),
	sap: require('controllers/monitor/controladorConsultasSap'),
	procesos: require('controllers/monitor/controladorConsultasProcesos'),
	mongodb: require('controllers/monitor/controladorConsultasMongoDb'),
	apache: require('controllers/monitor/controladorConsultasApache'),
	cache: require('controllers/monitor/controladorConsultasCache'),
	sqlite: require('controllers/monitor/controladorConsultasSQLite')
}
