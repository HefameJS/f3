'use strict';
////const C = global.config;
const L = global.logger;
//const K = global.constants;

const ErrorFedicom = require('model/ModeloErrorFedicom');

const tryCatch = (funcionControlador) => {
	let controlador = (req, res) => {
		let txId = req.txId;
		try {
			funcionControlador(req, res);
		} catch (excepcion) {
			let errorFedicom = ErrorFedicom.desdeExcepcion(txId, excepcion);
			L.xf(txId, ['Ocurrió un error al ejecutar la petición', errorFedicom])
			errorFedicom.enviarRespuestaDeError(res);
			L.dump(excepcion, req)
			return;
		}
	}
	return controlador;
}


module.exports = tryCatch;