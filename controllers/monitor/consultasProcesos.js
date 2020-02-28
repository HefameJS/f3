'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Imongo = require(BASE + 'interfaces/imongo');


const consultaProcesos = function (req, res) {
	var txId = req.txId;

	L.xi(txId, ['Consulta de procesos']);

	req.token = Tokens.verifyJWT(req.token, req.txId);
	if (req.token.meta.exception) {
		L.xe(req.txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		req.token.meta.exception.send(res);
		return;
	}

	L.xi(txId, ['Token correcto', req.token]);

	
	let control = Imongo.coleccionControl();
	if (control) {
		control.find({}).toArray()
			.then(procesos => {
				L.xi(txId, ['Obtenida lista de procesos']);
				res.status(200).json({ ok: true, data: procesos });
			})
			.catch(err => {
				L.xe(txId, ['Error al obtener la lista de procesos', err]);
				res.status(500).json({ ok: false, error: (err.error || err.message) });
			})
	} else {
		L.xe(txId, ['Error al obtener la lista de procesos. No conectado a MDB']);
		res.status(500).json({ ok: false, error: "No se pudo obtener la lista de procesos." });

	}

}


module.exports = {
	consultaProcesos
}
