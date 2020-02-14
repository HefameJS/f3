'use strict';
//const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');

const tryCatch = (funcionControlador) => {
	let controlador = (req, res) => {
		let txId = req.txId;
		try {
			funcionControlador(req, res);
		} catch (exception) {
			let fedicomError = FedicomError.fromException(txId, exception);
			L.xf(txId, ['Ocurrió un error al ejecutar la petición', fedicomError])
			fedicomError.send(res);
			return;
		}
	}
	return controlador;
}


module.exports = tryCatch;