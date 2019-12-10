'use strict';
//const BASE = global.BASE;
const C = global.config;
//const L = global.logger;
const K = global.constants;

const ActiveDirectory = require('activedirectory');

const authenticate = (txId, authReq, callback) => {
    var ad = new ActiveDirectory(C.ldap);
    ad.authenticate(K.DOMINIOS.HEFAME + '\\' + authReq.username, authReq.password, callback);
};

module.exports = {
    authenticate: authenticate
}

