'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Imongo = require(BASE + 'interfaces/imongo');


// PUT /query
const consultaTX = function (req, res) {

	L.xi(txId, ['Consulta de transmisiones']);

	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	var txId = req.txId;
	var query = req.body;

	Imongo.consultaTX(query, (err, resultado) => {
		if (err) {
			console.log(err);
			res.status(500).json({ ok: false, error: (err.error || err.message) });
			return;
		}
		res.status(200).json({ ok: true, ...resultado });
	});

}

module.exports = {
	consultaTX,
	sap: require(BASE + 'controllers/monitor/controladorConsultasSap'),
	procesos: require(BASE + 'controllers/monitor/controladorConsultasProcesos'),
	mongodb: require(BASE + 'controllers/monitor/controladorConsultasMongoDb'),
	apache: require(BASE + 'controllers/monitor/controladorConsultasApache'),
	cache: require(BASE + 'controllers/monitor/controladorConsultasCache'),
	sqlite: require(BASE + 'controllers/monitor/controladorConsultasSQLite')
}
