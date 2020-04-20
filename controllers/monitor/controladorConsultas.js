'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require(BASE + 'util/tokens');
const iMongo = require(BASE + 'interfaces/imongo/iMongo');


// PUT /query
const consultaTransmisiones = function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	
	let query = req.body;

	iMongo.consultaTx.consulta(txId, query, (err, resultado) => {
		if (err) {
			res.status(500).json({ ok: false, error: (err.error || err.message) });
			return;
		}
		res.status(200).json({ ok: true, ...resultado });
	});

}

module.exports = {
	consultaTX: consultaTransmisiones,
	sap: require(BASE + 'controllers/monitor/controladorConsultasSap'),
	procesos: require(BASE + 'controllers/monitor/controladorConsultasProcesos'),
	mongodb: require(BASE + 'controllers/monitor/controladorConsultasMongoDb'),
	apache: require(BASE + 'controllers/monitor/controladorConsultasApache'),
	cache: require(BASE + 'controllers/monitor/controladorConsultasCache'),
	sqlite: require(BASE + 'controllers/monitor/controladorConsultasSQLite')
}
