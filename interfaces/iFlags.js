'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Externos
const memCache = require('memory-cache');
const cacheFlags = new memCache.Cache();
cacheFlags.countStats(false);


const set = (txId, flagName, value = true ) => {

    if (!txId) { L.e('No se ha especificado ID de transmisión'); return; }
    if (!flagName) { L.e('No se ha especificado nombre del flag'); return; }

    txId = new M.ObjectID(txId);
    let flags = cacheFlags.get(txId) || {};
    flags[flagName] = value;

    cacheFlags.put(txId, flags);
}

const get = (txId) => {
    let flags = cacheFlags.get(new M.ObjectID(txId));
    return flags || {};
}

const finaliza = (txId, mdbQuery) => {
    let flags = get(txId);
    del(txId);

    flags[C.flags.VERSION] = K.VERSION.TRANSMISION;

    if (!mdbQuery.$set) mdbQuery.$set = {};
    
    for (let flag in flags) {
        mdbQuery.$set['flags.' + flag] = flags[flag];
    }
}

const del = (txId) => {
    cacheFlags.del(new M.ObjectID(txId));
}

module.exports = {
    set,
    get,
    del,
    finaliza
};
