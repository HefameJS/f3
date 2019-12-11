'use strict';
//const BASE = global.BASE;
const C = global.config;
//const L = global.logger;
const K = global.constants;

const ActiveDirectory = require('activedirectory');
const clone = require('clone');

const authenticate = (txId, authReq, callback) => {

    var ldapConfig = clone(C.ldap);
    ldapConfig.baseDN = 'DC=hefame,DC=es';
    ldapConfig.username = authReq.domain + '\\' + authReq.username;
    ldapConfig.password = authReq.password;

    var ad = new ActiveDirectory(ldapConfig);

    ad.getGroupMembershipForUser(authReq.username, (ldapError, groups) => {
        if (ldapError || !groups || !groups.forEach) {
            callback(ldapError, false);
            return;
        }

        var grupos = [];
        groups.forEach( (group) => {
            if (group.cn.startsWith('FED3_'))
                grupos.push( group.cn );
        });

        callback(null, grupos);

    });
};

module.exports = {
    authenticate: authenticate
}

