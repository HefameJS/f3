'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


module.exports = {
	transmisiones: require('controladores/monitor/controladorConsultasTransmisiones'),
	agregaciones: require('controladores/monitor/controladorConsultasAgregaciones'),
	sap: require('controladores/monitor/controladorConsultasSap'),
	procesos: require('controladores/monitor/controladorConsultasProcesos'),
	mongodb: require('controladores/monitor/controladorConsultasMongoDb'),
	balanceadores: require('controladores/monitor/controladorConsultasBalanceadores'),
	sqlite: require('controladores/monitor/controladorConsultasSQLite'),
	maestro: require('controladores/monitor/controladorMaestros'),
	prtg: require('controladores/monitor/controladorConsultasPrtg'),
	//dumps: require('controladores/monitor/controladorConsultasDumps'),

}
