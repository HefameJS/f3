'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');

const cluster = require('cluster');
const OS = require('os')

let idIntervalo = null;
let vecesGanadoMaestro = {}



/**
 * Inicia un setInterval que va refrescando el registro del proceso
 * actual en la tabla de control.
 */
const iniciarIntervaloRegistro = () => {
	if (idIntervalo) return;

	setTimeout(limpiarLocales, K.PROCESS_REGISTER_INTERVAL / 2);

	idIntervalo = setInterval(() => {
		registrarProceso()
	}, K.PROCESS_REGISTER_INTERVAL)

}

/**
 * Detiene el registro periodico del proceso.
 */
const detenerIntervaloRegistro = () => {
	if (!idIntervalo) return;
	clearInterval(idIntervalo);
}

/**
 * Realiza una consulta a la tabla de control para determinar si el proceso
 * es el maestro de su tipo.
 * @param {*} tipoProceso 
 * @param {function} callback (err, false)
 */
const soyMaestro = (tipoProceso, callback) => {
	obtenerProcesoMaestro(tipoProceso, (err, procesos) => {
		if (err) {
			callback(err, false)
			return;
		}

		let maestro = procesos[0]

		if (!maestro || maestro.host === OS.hostname()) {
			if (!maestro) L.i(['No hay procesos compitiendo por ser maestros'], 'election')
			if (!vecesGanadoMaestro[tipoProceso] || vecesGanadoMaestro[tipoProceso] < 2) {
				if (!vecesGanadoMaestro[tipoProceso]) vecesGanadoMaestro[tipoProceso] = 0
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

				for (let i = 1; i < procesos.length; i++) {
					let candidato = procesos[i]
					if (!candidato) {break;}

					if (candidato.host === OS.hostname()) {
						L.i(['Yo soy el candidato con mayor prioridad, me postulo como próximo maestro'])
						asumirMaestro(tipoProceso)
						callback(null, false)
						return;
					} else {
						let diff = Date.fedicomTimestamp() - candidato.timestamp
						if (diff > 20000) {
							L.w(['El candidato ' + candidato.host + 'no ha dado señales de vida desde hace ' + diff / 1000 + ' segundos. Probamos el siguiente'], 'election')
						} else {
							L.i(['Hay un candidato en ' + candidato.host + ' con mayor prioridad. Espero a que de señales de vida',], 'election')
							callback(null, false)
							return;
						}
					}
				}
			}
		}




	})
}

/**
 * Obtiene la lista de procesos del tipo indicado.
 * @param {*} tipoProceso 
 * @param {*} callback 
 */
const consultaProcesos = (tipoProceso, host, callback) => {
	let filtro = {
		$or: [
			{priority: { $exists: false }}, 
			{priority: { $gte: 0 }}
		] 
	}

	if (tipoProceso) filtro.type = tipoProceso
	if (host) filtro.host = host


	let control = iMongo.colControl();
	if (control) {
		control.find(filtro).toArray()
			.then(res => {
				callback(null, res)
			})
			.catch(err => {
				L.e(['Error al obtener la lista de procesos', err]);
				callback(err, null)
			})
	} else {
		L.e(['Error al obtener la lista de procesos. No conectado a MDB']);
		callback({ error: 'No conectado a MDB' }, null)
	}
}

module.exports = {
	iniciarIntervaloRegistro,
	detenerIntervaloRegistro,
	soyMaestro,
	consultaProcesos
}



/**
 * Registra el proceso actual en la tabla de control
 */
const registrarProceso = () => {
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
	} else if (process.type === K.PROCESS_TYPES.CORE_MASTER) {
		datos.childrens = Math.max(parseInt(C.workers), 1) || (require('os').cpus().length - 1 || 1);
	}


	let update = {
		$setOnInsert: {
			init: Date.fedicomTimestamp()
		},
		$set: datos
	}

	let control = iMongo.colControl();
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
}


/**
 * Devuelve la información del proceso maestro para el tipo de 
 * proceso indidado
 * @param {*} tipoProceso 
 * @param {function} callback (err, procesoMaestro) =>
 */
const obtenerProcesoMaestro = (tipoProceso, callback) => {

	let filtro = {
		type: tipoProceso,
		priority: { $gte: 0 }
	}


	let control = iMongo.colControl();
	if (control) {
		control.find(filtro).sort({ priority: -1 }).toArray( (err, res) => {
			if (err) {
				L.e(['Error al obtener el proceso maestro', filtro, err], 'election');
				callback(err, null)
				return;
			}

			callback(null, res);

		})
	} else {
		L.e(['Error al obtener el proceso maestro. No conectado a MDB'], 'election');
		callback({ error: 'No conectado a MDB' }, null)
	}
}


/**
 * Hacer que el proceso lance una petición a la tabla de control
 * para hacerse maestro. 
 */
const asumirMaestro = (tipoProceso) => {

	let filtro = {
		type: tipoProceso,
		host: { $ne: OS.hostname() }
	}

	let control = iMongo.colControl();
	if (control) {
		control.updateMany(filtro, { $set: { priority: -1, maestro: 0 } }, (err, res) => {
			if (err) {
				L.e(['Error al asumir el rol de maestro', err], 'election');
				return;
			}
			L.i(['Lanzada petición a la red para obtener el rol de maestro', filtro], 'election');
		})

	} else {
		L.e(['Error al asumir el rol de maestro. No conectado a MDB'], 'election');
	}
}


/**
 * Elimina la información de registro de otros procesos del mismo tipo que el proceso
 * actual en el host del proceso actual.
 */
const limpiarLocales = () => {
	if (process.type === K.PROCESS_TYPES.CORE_WORKER) return;

	let filtro = {
		host: OS.hostname(),
		type: process.type
	}

	if (process.type === K.PROCESS_TYPES.CORE_MASTER) {
		filtro.type = { $in: [K.PROCESS_TYPES.CORE_WORKER, K.PROCESS_TYPES.CORE_MASTER] }
	}

	let control = iMongo.colControl();
	if (control) {
		control.deleteMany(filtro, { w: 0 })
			.then(res => {
				L.t(['Limpiados registros de proceso anteriores', filtro], 'procRegister');
				registrarProceso()
			})
			.catch(err => {
				L.e(['Error al borrar el registro de procesos', err, filtro], 'procRegister');
			})
	} else {
		L.e(['Error al borrar el registro de procesos. No conectado a MDB', filtro], 'procRegister');
	}

}