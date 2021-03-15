'use strict';
require('app-module-path').addPath(__dirname);



console.log('Inicializando servicios Fedicom v3', new Date());

require('bootstrap')().then(() => {

	const C = global.config;
	const L = global.logger;
	const K = global.constants;

	const cluster = require('cluster');

	process.titulo = K.PROCESOS.TITULOS.MASTER;
	process.tipo = K.PROCESOS.TIPOS.MASTER;
	C.pid.escribirFicheroPid();

	L.i('Fedicom3 v' + K.VERSION.SERVIDOR);
	L.i('Implementando norma Fedicom v' + K.VERSION.PROTOCOLO);
	L.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');


	let worker;

	// Lanzamiento de los workers
	
	L.i(['Lanzando procesos worker', C.numeroWorkers], 'cluster');
	cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WORKER + '.js' });
	for (let i = 0; i < C.numeroWorkers; i++) {
		worker = cluster.fork();
		worker.tipo = K.PROCESOS.TIPOS.WORKER;
	}
	
	

	// Lanzamiento del watchdog
	/*
	L.i(['Lanzando proceso WATCHDOG PEDIDOS'], 'cluster');
	cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS + '.js' });
	worker = cluster.fork();
	worker.tipo = K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS;
	*/

	// Lanzamiento del watchdog
	/*
	L.i(['Lanzando proceso WATCHDOG SQLITE'], 'cluster');
	cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.WATCHDOG_SQLITE + '.js' });
	worker = cluster.fork();
	worker.tipo = K.PROCESOS.TIPOS.WATCHDOG_SQLITE;
	*/


	// Lanzamiento del monitor
	/*
	L.i(['Lanzando procesos monitor'], 'cluster');
	cluster.setupMaster({ exec: 'f3-' + K.PROCESOS.TIPOS.MONITOR + '.js' });
	worker = cluster.fork();
	worker.tipo = K.PROCESOS.TIPOS.MONITOR;
	*/
	
	let registradorProcesos = require('interfaces/procesos/registradorProcesos');
//	registradorProcesos();
	

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