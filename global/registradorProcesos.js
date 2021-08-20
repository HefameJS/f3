'use strict';
const L = global.L;
const K = global.K;
const M = global.M;

const cluster = require('cluster');
const OS = require('os');

let DATOS_INSTANCIA = {};
let ID_INSTANCIA = {};
let idIntervalo = null;


module.exports = async () => {

	ID_INSTANCIA = { _id: OS.hostname().toLowerCase() };
	DATOS_INSTANCIA = {
		inicio: Date.fedicomTimestamp(),
		version: {
			protocolo: K.VERSION.PROTOCOLO,
			servidor: K.VERSION.SERVIDOR,
			baseDatos: K.VERSION.TRANSMISION,
			git: K.VERSION.GIT
		}
	}

	let intervaloRegistroEnEjecucion = false;
	idIntervalo = setInterval(async () => {

		let datosInstancia = {
			$setOnInsert: ID_INSTANCIA,
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
			await M.bd.collection('instancias').updateOne(ID_INSTANCIA, datosInstancia, { upsert: 1 })
			//L.trace('Instancia registrada', datosInstancia['$set']);
		} catch (errorMongo) {
			L.err('Capturado error en el registro de la instancia:', errorMongo);
		} finally {
			intervaloRegistroEnEjecucion = false;
		}


	}, 5000);

	return idIntervalo;
}