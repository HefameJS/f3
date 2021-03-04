'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');

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

	setTimeout(_limpiarLocales, K.PROCESS_REGISTER_INTERVAL / 2);

	idIntervalo = setInterval(() => {
		_registrarProceso()
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

	// Obtenemos la lista de procesos de este tipo que estén registrados y con prioridad > 0
	_obtenerProcesoMaestro(tipoProceso, (err, procesos) => {
		if (err) {
			L.e(['Ocurrió un error al obtener el proceso maestro', err], 'election');
			callback(err, false)
			return;
		}

		// Si la lista no viene vacía, el primero es el actual maestro (i.e. el que tiene mas prioridad)
		let maestro = procesos.length > 0 ? procesos[0] : null;

		// Si no hay maestro o YO soy el maestro!
		if (!maestro || maestro.host === OS.hostname()) {
			// Soy el único proceso de este tipo. Dejamos constancia en el log...
			if (!maestro) L.i(['No hay procesos compitiendo por ser maestros'], 'election');

			// Mientras no ganemos el proceso de convertirnos en maestro, simplemente esperamos ...
			if (!vecesGanadoMaestro[tipoProceso] || vecesGanadoMaestro[tipoProceso] < 3) {
				if (!vecesGanadoMaestro[tipoProceso]) vecesGanadoMaestro[tipoProceso] = 0
				vecesGanadoMaestro[tipoProceso]++
				L.i(['He ganado la elección de maestro ' + vecesGanadoMaestro[tipoProceso] + '/3 veces consecutivas'], 'election')
				callback(null, false);
				return;
				// Si hemos ganado ya mas de 3 veces la contienda, esta es la tercera vez que gamanos y somos el maestro!
			} else {
				L.i(['He ganado la elección de maestro suficientes veces, comienzo a hacer el trabajo de maestro'], 'election')
				callback(null, true);
				return;
			}

			// En el caso de que nos econtramos otro proceso siendo el maestro y que tiene una prioridad superior a la nuestra
		} else {
			// Si estabamos postulandonos a maestro, simplemente logeamos este hecho
			if (vecesGanadoMaestro[tipoProceso] > 0) L.t(['Un proceso con mayor prioridad ha reclamado ser maestro', maestro.host], 'election')

			L.t(['Según la lista de procesos, el maestro ahora mismo es ', maestro.host], 'election')

			vecesGanadoMaestro[tipoProceso] = 0

			// Si el maestro lleva mas de 20000 ms sin dar señales de vida, asumimos que está muerto
			let diff = Date.fedicomTimestamp() - maestro.timestamp
			if (diff > 20000) {

				L.w(['El maestro en ' + maestro.host + ' no ha dado señales de vida desde hace ' + diff / 1000 + ' segundos'], 'election')

				// Realizamos la comprobación del tiempo para todos los candidatos de la lista que tengan mas prioridad que yo
				for (let i = 1; i < procesos.length; i++) {
					let candidato = procesos[i]
					if (!candidato.host) { continue; }

					if (candidato.host === OS.hostname()) {
						L.i(['Yo soy el candidato con mayor prioridad, me postulo como próximo maestro'])
						_asumirMaestro(tipoProceso)
						callback(null, false) // Ojo, que aún no lo somos!
						return;
					} else {
						let diff = Date.fedicomTimestamp() - candidato.timestamp
						if (diff > 20000) {
							L.w(['El candidato ' + candidato.host + 'tampoco ha dado señales de vida desde hace tiempo. Probamos el siguiente', diff], 'election')
						} else {
							L.i(['Hay un candidato en ' + candidato.host + ' con mayor prioridad. Espero a que de señales de vida'], 'election')
							callback(null, false)
							return;
						}
					}
				}

				L.w(['Hemos terminado de recorrer la lista de procesos y ninguno opta para maestro. ¡Ni siquiera yo!. Es probable que aún no se hayan registrado'], 'election')
				callback(null, false)
				return;

			} else {
				L.t(['El maestro se registró hace poco tiempo, asumimos que está OK ', diff], 'election')
				callback(null, false)
				return;
			}
		}
	})
}

/**
 * Obtiene la lista de procesos del tipo indicado.
 * @param {*} tipoProceso 
 * @param {*} host
 * @param {*} callback 
 */
const consultaProcesos = (tipoProceso, host, callback) => {
	let filtro = {};

	if (tipoProceso) filtro.type = tipoProceso;
	if (host) filtro.host = host;

	let control = iMongo.colControl();
	if (control) {
		control.find(filtro).toArray((errorMongo, res) => {
			if (errorMongo) {
				L.e(['Error al obtener la lista de procesos', errorMongo]);
				callback(errorMongo, null);
				return;
			}
			callback(null, res);
		});

	} else {
		L.e(['Error al obtener la lista de procesos. No conectado a MDB']);
		callback({ error: 'No conectado a MDB' }, null);
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
const _registrarProceso = () => {
	let filtro = {
		pid: process.pid,
		host: OS.hostname()
	}

	let datos = {
		...filtro,
		version: K.VERSION.SERVIDOR,
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
const _obtenerProcesoMaestro = (tipoProceso, callback) => {

	let filtro = {
		type: tipoProceso,
		priority: { $gte: 0 }
	}


	let control = iMongo.colControl();
	if (control) {
		control.find(filtro).sort({ priority: -1 }).toArray((err, res) => {
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
const _asumirMaestro = (tipoProceso) => {

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
const _limpiarLocales = () => {
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
				_registrarProceso()
			})
			.catch(err => {
				L.e(['Error al borrar el registro de procesos', err, filtro], 'procRegister');
			})
	} else {
		L.e(['Error al borrar el registro de procesos. No conectado a MDB', filtro], 'procRegister');
	}

}