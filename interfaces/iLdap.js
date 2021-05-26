'use strict';
const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externo
const ActiveDirectory = require('activedirectory');

const autenticar = function (solicitudAutenticacion) {

	return new Promise((resolve, reject) => {

		let configuracionLdap = C.ldap.getParametrosActiveDirectory(solicitudAutenticacion);

		let activeDirectory = new ActiveDirectory(configuracionLdap);
		
		activeDirectory.authenticate(configuracionLdap.username, configuracionLdap.password, (authErr, authResult) => {
			if (authErr) {
				reject(authErr);
				return;
			}

			activeDirectory.getGroupMembershipForUser(solicitudAutenticacion.usuario, (errorLdap, gruposAd) => {
				if (errorLdap || !gruposAd || !gruposAd.forEach) {
					reject(errorLdap);
					return;
				}

				let grupos = gruposAd
								.filter(grupoAd => (grupoAd.cn && grupoAd.cn.startsWith(C.ldap.prefijoGrupos)))
								.map(grupoAd => grupoAd.cn)
				resolve(grupos);
			})
		});
	});
}

module.exports = {
	autenticar
}

