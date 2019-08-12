'use strict';
const BASE = global.BASE;
const L = global.logger;
const config = global.config;

const FedicomError = require(BASE + 'model/fedicomError');

module.exports = {
	sendException: function(ex, req, res) {
		var responseBody = '';
		var errorToLog = ex;

		if (ex.send) { // Es un FedicomError
			responseBody = ex.send(res);
		} else { // Es una Excepcion standard
			var error = new FedicomError('HTTP-500', 'Error interno del servidor - ' + req.txId, 500);
			responseBody = error.send(res);
			errorToLog =  ex.stack ? ex.stack.split(/\r?\n/) : (ex ? ex.toString() : 'null');
		}

		L.xe(req.txId, ['Se detectó un error al analizar la transmisión. Se transmite el error al cliente', errorToLog, responseBody]);
		return responseBody;
	}
}
