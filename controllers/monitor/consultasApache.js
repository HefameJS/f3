'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Iapache = require(BASE + 'interfaces/apache/iapache');

const consultaBalanceadorApache = (req, res) => {

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


const actualizaBalanceadorApache = (req, res) => {

	var txId = req.txId;

	req.token = Tokens.verifyJWT(req.token, txId);
	if (req.token.meta.exception) {
		L.xe(txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		req.token.meta.exception.send(res);
		return;
	}
	if (!req.token.perms || !req.token.perms.includes('FED3_BALANCEADOR')) {
		L.xw(txId, ['El usuario no tiene los permisos necesarios para cambiar los balanceadores', req.token.perms])
		var error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
		error.send(res);
		return;
	}


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

