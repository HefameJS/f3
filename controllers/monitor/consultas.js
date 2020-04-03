'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Imongo = require(BASE + 'interfaces/imongo');
const Isap = require(BASE + 'interfaces/isap')

// PUT /query
const consultaTX = function (req, res) {
	var txId = req.txId;
	var query = req.body;

	L.xi(txId, ['Consulta Generica a MDB']);


	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	L.xi(txId, ['Token correcto', req.token]);



	Imongo.consultaTX(query, (err, resultado) => {
		if (err) {
			console.log(err);
			res.status(500).json({ ok: false, error: (err.error || err.message) });
			return;
		}
		res.status(200).json({ ok: true, ...resultado });
	});

}


const consultaSap = function (req, res) {
	let sapSysName = req.query.sapSystem || C.sap_systems.default;

	Isap.ping(sapSysName, (err, status, sapSystem) => {
		if (!err) {
			res.status(200).json({ ok: true, data: { available: status, info: { baseUrl: sapSystem.preCalculatedBaseUrl, name: sapSysName } } });
		} else {
			res.status(200).json({ ok: true, data: { available: status, error: err } });
		}
	});
}





module.exports = {
	consultaTX,
	consultaSap,
	procesos: require(BASE + 'controllers/monitor/consultasProcesos'),
	mongodb: require(BASE + 'controllers/monitor/consultasMongoDb'),
	apache: require(BASE + 'controllers/monitor/consultasApache')
}
