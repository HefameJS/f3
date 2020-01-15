'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;

const ObjectID = require(BASE + 'interfaces/imongo').ObjectID;
const memCache = require('memory-cache');
const flagsCache = new memCache.Cache();
flagsCache.countStats(false);


const set = (txId, flagName) => {
    if (!txId) { L.e('No se ha especificado ID de transmisión'); return; }
    if (!flagName) { L.e('No se ha especificado nombre del flag'); return; }

    txId = new ObjectID(txId);
    let flags = flagsCache.get(txId) || {};
    flags[flagName] = true;

    flagsCache.put(txId, flags);
}


const get = (txId) => {
    let flags = flagsCache.get(new ObjectID(txId));
    return flags || {};
}


const finaliza = (txId, mdbQuery) => {
    let flags = get(txId);
    del(txId);

    flags.v = K.TX_VERSION;

    if (!mdbQuery.$set) mdbQuery.$set = {};
    
    for (var flag in flags) {
        mdbQuery.$set['flags.' + flag] = flags[flag];
    }

    console.log(mdbQuery);
}


const del = (txId) => {
    flagsCache.del(new ObjectID(txId));
}

module.exports = {
    set,
    get,
    del,
    finaliza
};
