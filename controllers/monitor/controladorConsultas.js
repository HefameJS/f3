'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


module.exports = {
	transmisiones: require('controllers/monitor/controladorConsultasTransmisiones'),
	sap: require('controllers/monitor/controladorConsultasSap'),
	procesos: require('controllers/monitor/controladorConsultasProcesos'),
	mongodb: require('controllers/monitor/controladorConsultasMongoDb'),
	balanceadores: require('controllers/monitor/controladorConsultasBalanceadores'),
	cache: require('controllers/monitor/controladorConsultasCache'),
	sqlite: require('controllers/monitor/controladorConsultasSQLite'),
	dumps: require('controllers/monitor/controladorConsultasDumps')

}
