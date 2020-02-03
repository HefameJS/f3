'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;


const cluster = require('cluster');
const OS = require('os')
const Imongo = require(BASE + 'interfaces/imongo');

var idIntervalo = null;
var vecesGanadoMaestro = {}



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
			datos.maestro = vecesGanadoMaestro[K.PROCESS_TYPES.WATCHDOG]
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

const asumirMaestro = () => {

	let filtro = {
		type: K.PROCESS_TYPES.WATCHDOG,
		host: {$ne: OS.hostname()}
	}


	let control = Imongo.coleccionControl();
	if (control) {
		control.updateMany(filtro, { $set: { priority: -1, maestro: 0} })
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


const obtenerProcesoMaestro = (tipoProceso, callback) => {

	let filtro = {
		type: tipoProceso,
		priority: { $gte: 0 }
	}


	let control = Imongo.coleccionControl();
	if (control) {
		control.find(filtro).sort({ priority: -1 }).toArray()
			.then(res => {
				callback(null, res)
			})
			.catch(err => {
				L.e(['Error al obtener el proceso maestro', err], 'election');
				callback(err, null)
			})
	} else {
		L.e(['Error al obtener el proceso maestro. No conectado a MDB'], 'election');
		callback({ error: 'No conectado a MDB' }, null)
	}
}

const soyMaestro = (tipoProceso, callback) => {
	obtenerProcesoMaestro(tipoProceso, (err, watchdogs) => {
		if (err) {
			callback(err, false)
			return;
		}

		let maestro = watchdogs[0]

		if (!maestro || maestro.host === OS.hostname()) {
			if (!maestro) L.i(['No hay procesos de watchdog compitiendo por ser maestros'], 'election')
			if (vecesGanadoMaestro[tipoProceso] < 2) {
				vecesGanadoMaestro[tipoProceso]++
				L.i(['He ganado la elección de maestro ' + vecesGanadoMaestro[tipoProceso] + '/3 veces consecutivas'], 'election')
				callback(null, false);
				return;
			} else if (vecesGanadoMaestro[tipoProceso] === 2) {
				vecesGanadoMaestro[tipoProceso]++
				L.i(['He ganado la elección de maestro suficientes veces, comienzo a hacer el trabajo de maestro'], 'election')
			}
			callback(null, true);
			return;
		} else {
			if (vecesGanadoMaestro[tipoProceso] > 0) L.t(['Un proceso con mayor prioridad ha reclamado ser maestro', maestro.host], 'election')
			// L.t(['No soy el maestro, el maestro es', maestro.host], 'election')

			vecesGanadoMaestro[tipoProceso] = 0

			let diff = Date.fedicomTimestamp() - maestro.timestamp
			if (diff > 20000) {
				L.w(['El maestro en ' + maestro.host + ' no ha dado señales de vida desde hace ' + diff / 1000 + ' segundos'], 'election')

				for (let i = 1; i < watchdogs.length; i++) {
					let candidato = watchdogs[i]
					if (!candidato) {break;}

					if (candidato.host === OS.hostname()) {
						L.i(['Yo soy el candidato con mayor prioridad, me postulo como próximo maestro'])
						asumirMaestro()
						callback(null, false)
						return;
					} else {
						let diff = Date.fedicomTimestamp() - candidato.timestamp
						if (diff > 20000) {
							L.w(['El candidato ' + candidato.host + 'no ha dado señales de vida desde hace ' + diff / 1000 + ' segundos. Probamos el siguiente'], 'election')
						} else {
							L.i(['Hay un candidato en ' + candidato.host + '  con mayor prioridad. Espero a que de señales de vida',], 'election')
							callback(null, false)
							return;
						}
					}
				}
			}
		}




	})
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
	soyMaestro
}