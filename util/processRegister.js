'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;


const cluster = require('cluster');
const OS = require('os')
const Imongo = require(BASE + 'interfaces/imongo');

let idIntervalo = null;


const iniciarIntervaloRegistro = () => {
	if (idIntervalo) return;

	setTimeout(limpiarLocales, K.PROCESS_REGISTER_INTERVAL / 2);

	idIntervalo = setInterval(() => {

		let filtro = {
			pid: process.pid,
			host: OS.hostname()
		}

		let datos = {
			...filtro,
			version: global.constants.SERVER_VERSION,
			type: process.type,
			status: K.PROCESS_STATUS.ALIVE,
			timestamp: Date.fedicomTimestamp()
		}
		if (!cluster.isMaster) datos.workerId = cluster.worker.id

		let update = { 
			$setOnInsert: { 
				init: Date.fedicomTimestamp() 
			},
			$set: datos 
		}

		let control = Imongo.coleccionControl();
		if (control) {
			control.updateOne(filtro, update, { upsert: true, w: 0 })
				.then(res => {
					// L.t(['Proceso registrado', datos], 'procRegister');
				})
				.catch(err => {
					L.e(['Error al registrar el proceso', err, datos], 'procRegister');
				})
		} else {
			L.e(['Error al registrar el proceso. No conectado a MDB', datos], 'procRegister');
		}

	}, K.PROCESS_REGISTER_INTERVAL)
}
const detenerIntervaloRegistro = () => {
	if (!idIntervalo) return;
	clearInterval(idIntervalo);
}


const limpiarLocales = () => {
	if (process.type === K.PROCESS_TYPES.CORE_WORKER) return;

	let filtro = {
		host: OS.hostname(),
		type: process.type
	}

	if (process.type === K.PROCESS_TYPES.CORE_MASTER) {
		filtro.type = { $in: [K.PROCESS_TYPES.CORE_WORKER, K.PROCESS_TYPES.CORE_MASTER ] }
	}

	let control = Imongo.coleccionControl();
	if (control) {
		control.deleteMany(filtro, { w: 0 })
			.then(res => {
				L.t(['Limpiados registros de proceso anteriores', filtro], 'procRegister');
			})
			.catch(err => {
				L.e(['Error al borrar el registro de procesos', err, filtro], 'procRegister');
			})
	} else {
		L.e(['Error al borrar el registro de procesos. No conectado a MDB', filtro], 'procRegister');
	}




}
module.exports = {
	iniciarIntervaloRegistro,
	detenerIntervaloRegistro
}