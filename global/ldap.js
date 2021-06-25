'use strict';

const C = global.C;
const ActiveDirectory = require('activedirectory');

module.exports = async function (solicitudAutenticacion) {

	let configuracionLdap = C.ldap.getParametrosActiveDirectory(solicitudAutenticacion);
	let activeDirectory = new ActiveDirectory(configuracionLdap);

	activeDirectory.authenticate(configuracionLdap.username, configuracionLdap.password, (authErr, authResult) => {
		if (authErr) throw authErr;

		activeDirectory.getGroupMembershipForUser(solicitudAutenticacion.usuario, (errorLdap, gruposAd) => {
			if (errorLdap || !Array.isArray(gruposAd)) throw errorLdap;

			let grupos = gruposAd
				.filter(grupoAd => (grupoAd.cn && grupoAd.cn.startsWith(C.ldap.prefijoGrupos)))
				.map(grupoAd => grupoAd.cn)
			return grupos;
		})
	});
}


