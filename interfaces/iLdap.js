'use strict';
//const BASE = global.BASE;
const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externo
const ActiveDirectory = require('activedirectory');
const clone = require('clone');

const autenticar = (txId, solicitudAutenticacion, callback) => {

    let configuracionLdap = clone(C.ldap);
    configuracionLdap.baseDN = 'DC=hefame,DC=es';
    configuracionLdap.username = solicitudAutenticacion.domain + '\\' + solicitudAutenticacion.username;
    configuracionLdap.password = solicitudAutenticacion.password;

    let activeDirectory = new ActiveDirectory(configuracionLdap);

    activeDirectory.authenticate(configuracionLdap.username, configuracionLdap.password, (authErr, authResult) => {
        if (authErr) {
            callback(authErr);
            return;
        }

        activeDirectory.getGroupMembershipForUser(solicitudAutenticacion.username, (errorLdap, gruposAd) => {
            if (errorLdap || !gruposAd || !gruposAd.forEach) {
                callback(errorLdap);
                return;
            }

            let grupos = [];
            gruposAd.forEach((grupoAd) => {
                if (grupoAd.cn && grupoAd.cn.startsWith('FED3_'))
                    grupos.push(grupoAd.cn);
            });

            callback(null, grupos);

        })
    });
}

module.exports = {
    autenticar
}

