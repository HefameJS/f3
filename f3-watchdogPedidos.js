'use strict';
require('app-module-path').addPath(__dirname);
global.constants = require('global/constantes');
const K = global.constants;

console.log('Inicializando Watchdog Pedidos Fedicom v3', new Date());

require('bootstrap')(K.PROCESOS.TIPOS.WATCHDOG_PEDIDOS).then(() => {

	const C = global.config;
	const L = global.logger;

	L.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');

	let funcionWatchdog = require('watchdog/watchdogMongodb');
	let funcionCalculaListaNegra = require('watchdog/calculadorListaNegra');
	let idIntervalo = null;
	let idIntervaloCalculaListaNegra = null;

	let reiniciaIntervalo = () => {
		if (C.watchdogPedidos.soyMaestro()) {
			L.i(['Soy el Watchdog Pedidos elegido']);
			idIntervalo = funcionWatchdog();
			idIntervaloCalculaListaNegra = funcionCalculaListaNegra();

		} else {
			L.w(['NO soy el Watchdog Pedidos elegido']);
			if (idIntervalo)
				clearInterval(idIntervalo);

			if (idIntervaloCalculaListaNegra)
				clearInterval(idIntervaloCalculaListaNegra);
		}
	}
	
	reiniciaIntervalo();
	C.registrarListener(() => {
		L.i(['configuracion refrescada']);
		reiniciaIntervalo();
	})


});
