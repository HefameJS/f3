'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iApache = require('interfaces/apache/iapache');

// GET /status/apache/balanceadores
const consultaBalanceadorApache = (req, res) => {

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let servidor = req.query.servidor || (C.production ? 'fedicom3' : 'fedicom3-dev')
	let secure = req.query.https === 'no' ? false : true;
	servidor = (secure ? 'https' : 'http') + '://' + servidor + '.hefame.es'

	iApache.consultaBalanceador(servidor, (err, balanceadores) => {
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

	let estadoToken = iTokens.verificaPermisos(req, res, { grupoRequerido: 'FED3_BALANCEADOR'});
	if (!estadoToken.ok) return;

	let servidor = req.query.servidor || (C.production ? 'fedicom3' : 'fedicom3-dev')
	let secure = req.query.https === 'no' ? false : true;
	servidor = (secure ? 'https' : 'http') + '://' + servidor + '.hefame.es'

	let peticion = req.body

	iApache.actualizarWorker(servidor, peticion.balanceador, peticion.worker, peticion.nonce, peticion.estado, peticion.peso, (err, balanceadores) => {
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

