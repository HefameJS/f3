'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Iapache = require(BASE + 'interfaces/apache/iapache');

// GET /status/apache/balanceadores
const consultaBalanceadorApache = (req, res) => {

	let estadoToken = Tokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let servidor = req.query.servidor || (C.production ? 'fedicom3' : 'fedicom3-dev')
	let secure = req.query.https === 'no' ? false : true;
	servidor = (secure ? 'https' : 'http') + '://' + servidor + '.hefame.es'

	Iapache.getBalanceadores(servidor, (err, balanceadores) => {
		if (err) {
			L.e(['Error al consultar los balanceadores', err]);
			res.status(500).json({ ok: false, error: err });
		} else {
			res.status(200).json({ ok: true, data: balanceadores });
		}
	})
}

// PUT /status/apache/balanceadores
const actualizaBalanceadorApache = (req, res) => {

	let estadoToken = Tokens.verificaPermisos(req, res, { grupoRequerido: 'FED3_BALANCEADOR'});
	if (!estadoToken.ok) return;

	let servidor = req.query.servidor || (C.production ? 'fedicom3' : 'fedicom3-dev')
	let secure = req.query.https === 'no' ? false : true;
	servidor = (secure ? 'https' : 'http') + '://' + servidor + '.hefame.es'

	let peticion = req.body

	Iapache.actualizarWorker(servidor, peticion.balanceador, peticion.worker, peticion.nonce, peticion.estado, peticion.peso, (err, balanceadores) => {
		if (err) {
			L.e(['Error al consultar los balanceadores', err]);
			res.status(500).json({ ok: false, error: err });
		} else {
			res.status(200).json({ ok: true, data: balanceadores });
		}
	})
}



module.exports = {
	consultaBalanceadorApache,
	actualizaBalanceadorApache
}

