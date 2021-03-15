'use strict';
require('app-module-path').addPath(__dirname);


console.log('Inicializando Watchdog SQLite Fedicom v3', new Date());

require('bootstrap')().then(() => {

	const C = global.config;
	const L = global.logger;
	const K = global.constants;

	const cluster = require('cluster');

	process.worker = cluster.worker.id;
	process.titulo = K.PROCESOS.TITULOS.WATCHDOG_SQLITE + '-' + process.worker;
	process.tipo = K.PROCESOS.TIPOS.WATCHDOG_SQLITE;
	C.pid.escribirFicheroPid();

	L.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');



	let funcionWatchdog = require('watchdog/watchdogSqlite');

	let idIntervalo = funcionWatchdog();


});
