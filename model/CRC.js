'use strict';
//const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

const crypto = require('crypto');

const crear = (codigoCliente, numeroPedidoOrigen) => {
	let hash = crypto.createHash('sha1');
	return hash.update(codigoCliente + numeroPedidoOrigen).digest('hex').substring(1, 25).toUpperCase();
}

module.exports = {
	crear: crear
}