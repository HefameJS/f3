'use strict';
require('app-module-path').addPath(__dirname);
global.constants = require('global/constantes');
const K = global.constants;

console.log('Inicializando Watchdog SQLite Fedicom v3', new Date());

require('bootstrap')(K.PROCESOS.TIPOS.WATCHDOG_SQLITE).then(() => {

	let funcionWatchdog = require('watchdog/watchdogSqlite');
	funcionWatchdog();

});
