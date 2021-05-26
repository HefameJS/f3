'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;

// Externos

const iFlagsComun = require('./iFlagsComun');

module.exports = {
	set: iFlagsComun.set,
	get: iFlagsComun.get,
	del: iFlagsComun.del,
	finaliza: iFlagsComun.finaliza,
	transmision: require('./iFlagsTransmision'),
	autenticacion: require('./iFlagsAutenticacion'),
	sap: require('./iFlagsSap'),
};
