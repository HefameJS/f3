'use strict';

const C = global.C;
const ActiveDirectory = require('activedirectory');


module.exports.autenticar = function (solicitudAutenticacion) {

	return new Promise((accept, reject) => {
		let configuracionLdap = C.ldap.getParametrosActiveDirectory(solicitudAutenticacion);
		let activeDirectory = new ActiveDirectory(configuracionLdap);

		activeDirectory.authenticate(configuracionLdap.username, configuracionLdap.password, (authErr, authResult) => {
			if (authErr) {
				reject(authErr);
				return;
			}

			activeDirectory.getGroupMembershipForUser(solicitudAutenticacion.usuario, (errorLdap, gruposAd) => {
				if (errorLdap || !Array.isArray(gruposAd)) {
					reject(errorLdap);
					return;
				}

				let grupos = gruposAd
					.filter(grupoAd => (grupoAd.cn && grupoAd.cn.startsWith(C.ldap.prefijoGrupos)))
					.map(grupoAd => grupoAd.cn)
				accept(grupos);
			})
		});
	});
}




