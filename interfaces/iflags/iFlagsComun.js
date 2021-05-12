'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Externos
const memCache = require('memory-cache');
const cacheFlags = new memCache.Cache();
cacheFlags.countStats(false);


exports.set = (txId, flagName, value = true) => {

	if (!txId) { L.e('No se ha especificado ID de transmisión', 'iFlags'); return; }
	if (!flagName) { L.e('No se ha especificado nombre del flag', 'iFlags'); return; }

	L.xt(txId, ['Estableciendo flag', flagName, value, txId], 'iFlags');

	txId = new M.ObjectID(txId);
	let flags = cacheFlags.get(txId) || {};
	flags[flagName] = value;

	cacheFlags.put(txId, flags);
}

exports.get = (txId) => {
	let flags = cacheFlags.get(new M.ObjectID(txId));
	return flags || {};
}

exports.del = (txId) => {
	L.xt(txId, ['Borrando flags', txId], 'iFlags');
	cacheFlags.del(new M.ObjectID(txId));
}

exports.finaliza = (txId, mdbQuery) => {
	let flags = exports.get(txId);
	flags[C.flags.VERSION] = K.VERSION.TRANSMISION;

	if (!mdbQuery.$set) mdbQuery.$set = {};

	L.xd(txId, ['Finalizando flags', flags, txId], 'iFlags');

	for (let flag in flags) {
		mdbQuery.$set['flags.' + flag] = flags[flag];
	}
	exports.del(txId);
}