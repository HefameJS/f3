'use strict';
require('app-module-path').addPath(__dirname);


console.log('Inicializando Watchdog Pedidos Fedicom v3', new Date());

require('bootstrap')().then(() => {

	const C = global.config;
	const L = global.logger;
	const K = global.constants;

	const cluster = require('cluster');

	process.worker = cluster.worker.id;
	process.titulo = K.PROCESOS.TITULOS.WATCHDOG_PEDIDOS + '-' + process.worker;
	process.tipo = K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS;
	C.pid.escribirFicheroPid();

	L.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');



	let funcionWatchdog = require('watchdog/watchdogMongodb');
	let idIntervalo = null;

	let reiniciaIntervalo = () => {
		if (C.watchdogPedidos.soyMaestro()) {

			L.i(['Soy el Watchdog Pedidos elegido']);
			idIntervalo = funcionWatchdog();

		} else {

			L.w(['NO soy el Watchdog Pedidos elegido']);
			if (idIntervalo)
				clearInterval(idIntervalo);

		}
	}
	

	reiniciaIntervalo();
	C.registrarListener(() => {
		L.i(['configuracion refrescada']);
		reiniciaIntervalo();
	})



	//require('watchdog/mdb');
	//require('watchdog/sqlite');


});
