'use strict';
require('app-module-path').addPath(__dirname);
console.log('Inicializando Watchdog SQLite Fedicom v3', new Date());

require('bootstrap')('watchdogSqlite').then(() => {

	let funcionWatchdog = require('watchdog/watchdogSqlite');
	funcionWatchdog();

});
