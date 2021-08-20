'use strict';
require('app-module-path').addPath(__dirname);

console.log('Inicializando servicios Fedicom v3', new Date());

require('global/bootstrap')('master').then(() => {

	const C = global.C;
	const L = global.L;
	const K = global.K;

	const cluster = require('cluster');

	L.info(`Fedicom3 v${K.VERSION.SERVIDOR}`);
	L.info(`Implementando norma Fedicom v${K.VERSION.PROTOCOLO} `);

	let worker;

	// Lanzamiento de los workers
	if (C.numeroWorkers > 0) {
		L.info(`Lanzando ${C.numeroWorkers} procesos ${K.PROCESOS.TIPOS.WORKER}`);
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WORKER + '.js' });
		for (let i = 0; i < C.numeroWorkers; i++) {
			worker = cluster.fork();
			worker.tipo = K.PROCESOS.TIPOS.WORKER;
		}
	} else {
		L.warn(`No se lanza ningún proceso ${K.PROCESOS.TIPOS.WORKER} porque así se indica en la configuración`);
	}

	// Lanzamiento del watchdog
	if (!C.sinWatchdogPedidos) {
		L.info(`Lanzando proceso ${K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS}`);
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS + '.js' });
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS;
	} else {
		L.warn(`No se lanza el proceso ${K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS} porque así se indica en la configuración`);
	}

	// Lanzamiento del watchdog SQLITE
	if (!C.sinWatchdogSqlite) {
		L.info(`Lanzando proceso ${K.PROCESOS.TIPOS.WATCHDOG_SQLITE}`);
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WATCHDOG_SQLITE + '.js' });
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.WATCHDOG_SQLITE;
	} else {
		L.warn(`No se lanza el proceso ${K.PROCESOS.TIPOS.WATCHDOG_SQLITE} porque así se indica en la configuración`);
	}

	// Lanzamiento del monitor
	if (!C.sinMonitor) {
		L.info(`Lanzando proceso ${K.PROCESOS.TIPOS.MONITOR}`);
		cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.MONITOR + '.js' });
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.MONITOR;
	} else {
		L.warn(`No se lanza el proceso ${K.PROCESOS.TIPOS.MONITOR} porque así se indica en la configuración`);
	}


	let registradorProcesos = require('global/registradorProcesos');
	registradorProcesos();

	cluster.on('exit', (workerMuerto, code, signal) => {
		L.fatal(`Un worker ha muerto. Vamos a intentar levantarlo:`, {iid: workerMuerto.id, tipo: workerMuerto.tipo, code, signal});

		if (workerMuerto.tipo) {
			cluster.setupMaster({ exec: 'f3-' + workerMuerto.tipo + '.js' });
			let worker = cluster.fork();
			worker.tipo = workerMuerto.tipo;
		} else {
			L.fatal('No se encontró el tipo del worker muerto, por lo que no se que proceso resucitar');
		}

	});
});