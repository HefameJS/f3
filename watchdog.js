'use strict';
require('./globals');
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;



process.title = K.PROCESS_TITLES.WATCHDOG;
process.type = K.PROCESS_TYPES.WATCHDOG;

global.instanceID += '-wd';
global.config = require(BASE + 'config');
global.logger = require(BASE + 'util/logger');

process.on('uncaughtException', function (err) {
	L.dump(err)
	process.exit(1)
})

L.i('**** ARRANCANDO WATCHDOG FEDICOM 3 - ' + K.SERVER_VERSION + ' ****');
L.i('*** Implementando protololo Fedicom v' + K.PROTOCOL_VERSION + ' ****');
L.i('*** ID de instancia: ' + global.instanceID );

var pidFile = (C.pid || '.') + '/' + process.title + '.pid';
require('fs').writeFile(pidFile, process.pid, function(err) {
	 if(err) {
		  L.e(["Error al escribir el fichero del PID",err]);
	 }
});

const mdbWatchdog = require(BASE + 'watchdog/mdb');
const sqliteWatchdog = require(BASE + 'watchdog/sqlite');


require(BASE + 'interfaces/procesos/iRegistroProcesos').iniciarIntervaloRegistro();

