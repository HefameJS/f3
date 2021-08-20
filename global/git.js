'use strict';
const fs = require('fs').promises;

const cacheMetadatosGit = {
	commit: null,
	timestamp: 0
}

module.exports.obtenerCommitHash = async () => {

	if (cacheMetadatosGit.commit) {
		return cacheMetadatosGit;
	}

	try {
		let commitHash = (await fs.readFile('.git/HEAD')).toString().trim();
		let stats = {};
		if (commitHash.indexOf(':') === -1) {
			stats = await fs.stat('.git/HEAD');
		} else {
			let ficheroHEAD = '.git/' + commitHash.substring(5);
			commitHash = (await fs.readFile(ficheroHEAD)).toString().trim();
			stats = await fs.stat(ficheroHEAD);
		}

		cacheMetadatosGit.commit = commitHash;
		cacheMetadatosGit.timestamp = Math.floor(stats?.mtimeMs);

	} catch (errorFs) {
		console.error('Excepción al obtener información del repositorio GIT', errorFs);
	}


	return cacheMetadatosGit;


}


