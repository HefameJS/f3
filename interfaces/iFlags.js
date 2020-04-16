'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

// Externos
const memCache = require('memory-cache');

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');



const ObjectID = iMongo.ObjectID;
const cacheFlags = new memCache.Cache();
cacheFlags.countStats(false);


const set = (txId, flagName, value = true ) => {

    if (!txId) { L.e('No se ha especificado ID de transmisión'); return; }
    if (!flagName) { L.e('No se ha especificado nombre del flag'); return; }

    txId = new ObjectID(txId);
    let flags = cacheFlags.get(txId) || {};
    flags[flagName] = value;

    cacheFlags.put(txId, flags);
}

const get = (txId) => {
    let flags = cacheFlags.get(new ObjectID(txId));
    return flags || {};
}

const finaliza = (txId, mdbQuery) => {
    let flags = get(txId);
    del(txId);

    flags[K.FLAGS.VERSION] = K.TX_VERSION;

    if (!mdbQuery.$set) mdbQuery.$set = {};
    
    for (var flag in flags) {
        mdbQuery.$set['flags.' + flag] = flags[flag];
    }
}

const del = (txId) => {
    cacheFlags.del(new ObjectID(txId));
}

module.exports = {
    set,
    get,
    del,
    finaliza
};
