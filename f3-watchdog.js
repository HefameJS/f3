'use strict';
require('app-module-path').addPath(__dirname);


console.log('Inicializando servicios Fedicom v3', new Date());

require('bootstrap')().then(() => {

	const C = global.config;
	const L = global.logger;
	const K = global.constants;

	const cluster = require('cluster');

	process.worker = cluster.worker.id;
	process.titulo = K.PROCESOS.TITULOS.WATCHDOG + '-' + process.worker;
	process.tipo = K.PROCESOS.TIPOS.WATCHDOG;
	C.pid.escribirFicheroPid();

	L.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');


	//require('watchdog/mdb');
	//require('watchdog/sqlite');
	//require('interfaces/procesos/iRegistroProcesos').iniciarIntervaloRegistro();


});
