'use strict';
require('app-module-path').addPath(__dirname);
console.log('Inicializando Watchdog SQLite Fedicom v3', new Date());

require('global/bootstrap')('watchdogSqlite').then(() => {

	let funcionWatchdog = require('_watchdog/watchdogSqlite');
	funcionWatchdog();

});
