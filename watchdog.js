'use strict';
require('app-module-path').addPath(__dirname);

require('globals');
const C = global.config;
const L = global.logger;
const K = global.constants;



process.title = K.PROCESS_TITLES.WATCHDOG;
process.type = K.PROCESS_TYPES.WATCHDOG;

global.instanceID += '-wd';
global.config = require('config');
global.logger = require('util/logger');

process.on('uncaughtException', (excepcionNoControlada) => {
	L.dump(excepcionNoControlada)
	process.exit(1)
})

L.i('**** ARRANCANDO WATCHDOG FEDICOM 3 - ' + K.SERVER_VERSION + ' ****');
L.i('*** Implementando protololo Fedicom v' + K.PROTOCOL_VERSION + ' ****');
L.i('*** ID de instancia: ' + global.instanceID );

let ficheroPID = (C.pid || '.') + '/' + process.title + '.pid';
require('fs').writeFile(ficheroPID, '' + process.pid, (err) => {
	 if(err) {
		  L.e(["Error al escribir el fichero del PID",err]);
	 }
});


require('watchdog/mdb');
require('watchdog/sqlite');
require('interfaces/procesos/iRegistroProcesos').iniciarIntervaloRegistro();

