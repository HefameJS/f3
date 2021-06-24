'use strict';
const M = global.mongodb;

const crypto = require('crypto');

class Crc {
	static generar(...valores) {
		let base = valores.reduce((acumulado, actual) => {
			return acumulado + actual;
		}, ''); // Poner '' como valor inicial nos garantiza un string a la salida
		let hash = crypto.createHash('sha1');
		return new M.ObjectID(hash.update(base).digest('hex').substring(1, 25));
	}
}

module.exports = Crc;