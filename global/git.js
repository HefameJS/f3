'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;



const fs = require('fs').promises;

const obtenerCommitHash = async function () {

	try {
		let commitHash = (await fs.readFile('.git/HEAD')).toString().trim();
		console.log(commitHash);
		let stats = {};
		if (commitHash.indexOf(':') === -1) {
			stats = await fs.stat('.git/HEAD');
		} else {
			
			let ficheroHEAD = '.git/' + commitHash.substring(5);
			
			commitHash = (await fs.readFile(ficheroHEAD)).toString().trim();
			stats = await fs.stat(ficheroHEAD);
		}


		return {
			commit: commitHash,
			timestamp: stats?.mtimeMs,
			fecha: stats?.mtime
		}

	} catch (errorFs) {
		return {
			commit: null,
			timestamp: 0,
			fecha: ""
		}
	}



}

module.exports = {
	obtenerCommitHash
}

