'use strict';

require('global/extensiones/extensionesNativas');

module.exports = async function () {

	// ID de instancia del proceso actual
	process.iid = require('os').hostname() + '-' + process.pid;

	global.constants = require('global/constantes');
	global.config = require('global/configuracion');
	global.logger = require('global/logger');

	process.on('uncaughtException', (excepcionNoControlada) => {
		global.logger.dump(excepcionNoControlada);
		global.config.pid.borrarFicheroPid();
		process.exit(1);
	})

	process.on('exit', (code) => {
		global.config.pid.borrarFicheroPid();
		process.exit(code);
	});

	let conectarMongo = require('interfaces/imongo/iMongoConexion');

	global.mongodb = await conectarMongo();
	await global.config.cargarDatosCluster();

}






// while (!conexionEstablecida);

