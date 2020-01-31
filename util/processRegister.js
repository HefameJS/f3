'use strict';
const BASE = global.BASE;
const C = global.config;
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
		if (process.type === K.PROCESS_TYPES.WATCHDOG) {
			datos.priority = C.watchdog.priority || -1
		}

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

const obtenerWatchdogMaestro = ( callback ) => {

	let filtro = {
		type: K.PROCESS_TYPES.WATCHDOG,
		priority: { $gte: 0 }
	}

	if (process.type === K.PROCESS_TYPES.CORE_MASTER) {
		filtro.type = { $in: [K.PROCESS_TYPES.CORE_WORKER, K.PROCESS_TYPES.CORE_MASTER] }
	}

	let control = Imongo.coleccionControl();
	if (control) {
		control.find(filtro).sort({ priority: -1 }).toArray()
			.then(res => {
				callback(null, res)
			})
			.catch(err => {
				L.e(['Error al obtener el watchdog maestro', err], 'election');
				callback(err, null)
			})
	} else {
		L.e(['Error al obtener el watchdog maestro. No conectado a MDB'], 'election');
		callback({error: 'No conectado a MDB'}, null)
	}
}

const asumirMaestro = () => {

	let filtro = {
		type: K.PROCESS_TYPES.WATCHDOG,
		host: {$ne: OS.hostname()}
	}


	let control = Imongo.coleccionControl();
	if (control) {
		control.updateMany(filtro, { $set: { priority: -1} })
			.then(res => {
				L.e(['Lanzada petición a la red para obtener el rol de watchdog maestro'], 'election');
			})
			.catch(err => {
				L.e(['Error al asumir el rol de watchdog maestro', err], 'election');
			})
	} else {
		L.e(['Error al asumir el rol de watchdog maestro. No conectado a MDB'], 'election');
	}
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
	detenerIntervaloRegistro,
	obtenerWatchdogMaestro,
	asumirMaestro
}