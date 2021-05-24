'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
//const iTokens = require('global/tokens');
const Maestro = require('global/maestro');


// GET /maestro
exports.consultaMaestro = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Consulta del MAESTRO']);	
	res.status(200).json(Maestro);
	
}

