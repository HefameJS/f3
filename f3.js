'use strict';
require('app-module-path').addPath(__dirname);
global.constants = require('global/constantes');
const K = global.constants;

console.log('Inicializando servicios Fedicom v3', new Date());

require('bootstrap')(K.PROCESOS.TIPOS.MASTER).then(() => {

	const C = global.config;
	const L = global.logger;

	const cluster = require('cluster');

	L.i('Fedicom3 v' + K.VERSION.SERVIDOR);
	L.i('Implementando norma Fedicom v' + K.VERSION.PROTOCOLO);

	let worker;

	// Lanzamiento de los workers
	if (C.numeroWorkers > 0) {
		L.i(['Lanzando procesos WORKER', C.numeroWorkers], 'cluster');
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WORKER + '.js' });
		for (let i = 0; i < C.numeroWorkers; i++) {
			worker = cluster.fork();
			worker.tipo = K.PROCESOS.TIPOS.WORKER;
		}
	} else {
		L.w(['No se lanza ningún WORKER porque así se indica en la configuración'], 'cluster');
	}

	// Lanzamiento del watchdog
	if (!C.sinWatchdogPedidos) {
		L.i(['Lanzando proceso WATCHDOG PEDIDOS'], 'cluster');
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS + '.js' });
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS;
	} else {
		L.w(['No se lanza el WATCHDOG PEDIDOS porque así se indica en la configuración'], 'cluster');
	}

	// Lanzamiento del watchdog SQLITE
	if (!C.sinWatchdogSqlite) {
		L.i(['Lanzando proceso WATCHDOG SQLITE'], 'cluster');
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WATCHDOG_SQLITE + '.js' });
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.WATCHDOG_SQLITE;
	} else {
		L.w(['No se lanza el WATCHDOG SQLITE porque así se indica en la configuración'], 'cluster');
	}

	// Lanzamiento del monitor
	if (!C.sinMonitor) {
		L.i(['Lanzando proceso MONITOR'], 'cluster');
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.MONITOR + '.js' });
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.MONITOR;
	} else {
		L.w(['No se lanza el MONITOR porque así se indica en la configuración'], 'cluster');
	}


	let registradorProcesos = require('watchdog/registradorProcesos');
	registradorProcesos();


	cluster.on('exit', (workerMuerto, code, signal) => {
		L.f(['Un worker ha muerto. Vamos a intentar levantarlo', workerMuerto.id, workerMuerto.tipo, code, signal], 'cluster');

		if (workerMuerto.tipo) {
			L.f(['El proceso muerto es de tipo', workerMuerto.tipo], 'cluster');
			cluster.setupMaster({ exec: 'f3-' + workerMuerto.tipo + '.js' });
			let worker = cluster.fork();
			worker.tipo = workerMuerto.tipo;
		} else {
			L.f(['NO se encontró el tipo del worker muerto'], 'cluster');
		}

	});
});