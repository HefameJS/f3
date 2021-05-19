'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

const crypto = require('crypto');

function crear(codigoCliente, numeroPedidoOrigen) {

	let hash = crypto.createHash('sha1');
	return hash.update(codigoCliente + numeroPedidoOrigen)
		.digest('hex').substring(1, 25).toUpperCase();

}

function generar(...valores) {
	let base = valores.reduce((acumulado, actual) => {
		return acumulado + actual;
	}, ''); // Poner '' como valor inicial nos garantiza un string a la salida
	let hash = crypto.createHash('sha1');
	return hash.update(base).digest('hex').substring(1, 25).toUpperCase();
}

module.exports = {
	crear,
	generar
}