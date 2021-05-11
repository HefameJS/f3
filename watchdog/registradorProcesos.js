'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;



const cluster = require('cluster');
const OS = require('os');
const fs = require('fs');

let DATOS_INSTANCIA = {};
let CLAVE_MONGODB = {};
let idIntervalo = null;


const _obtenerGitCommitHash = function () {
	let commitHash = fs.readFileSync('.git/HEAD').toString().trim();
	let stats = {};
	if (commitHash.indexOf(':') === -1) {
		stats = fs.statSync('.git/HEAD');
	} else {
		let ficheroHEAD = '.git/' + commitHash.substring(5);
		commitHash = fs.readFileSync(ficheroHEAD).toString().trim();
		stats = fs.statSync(ficheroHEAD);
	}

	return {
		commit: commitHash,
		timestamp: stats?.mtimeMs,
		fecha: stats?.mtime
	}
}

let intervaloRegistroEnEjecucion = false;


module.exports = () => {


	CLAVE_MONGODB = { _id: OS.hostname().toLowerCase() };
	DATOS_INSTANCIA = {
		inicio: Date.fedicomTimestamp(),
		version: {
			protocolo: K.VERSION.PROTOCOLO,
			servidor: K.VERSION.SERVIDOR,
			baseDatos: K.VERSION.TRANSMISION,
			git: _obtenerGitCommitHash()
		}
	}

	idIntervalo = setInterval(async () => {

		let datosInstancia = {
			$setOnInsert: CLAVE_MONGODB,
			$set: {
				...DATOS_INSTANCIA,
				timestamp: Date.fedicomTimestamp(),
				procesos: Object.values(cluster.workers).map(worker => {
					return {
						id: worker.id,
						tipo: worker.tipo,
						pid: worker.process?.pid
					}
				})
			}
		}

		try {
			intervaloRegistroEnEjecucion = true;
			await M.bd.collection('instancias').updateOne(CLAVE_MONGODB, datosInstancia, { upsert: 1 })
			//L.t(['Instancia registrada', datosInstancia['$set']]);
		} catch (errorMongo) {
			L.e(['Capturado error en el registro de la instancia', errorMongo]);
		} finally {
			intervaloRegistroEnEjecucion = false;
		}


	}, 5000);

	return idIntervalo;
}