'use strict';

require('global/extensiones/extensionesDate');
require('global/extensiones/extensionesError');

module.exports = async function (tipoProceso) {

	const cluster = require('cluster');
	const K = global.constants;

	K.VERSION.GIT = await require('global/git').obtenerCommitHash();

	// ID de instancia del proceso actual
	process.tipo = tipoProceso;
	process.iid = require('os').hostname() + '-' + process.pid;
	if (cluster.isWorker) {
		process.worker = cluster.worker.id;
		process.titulo = K.PROCESOS.getTitulo(tipoProceso) + '-' + process.worker;
	} else {
		process.titulo = K.PROCESOS.getTitulo(tipoProceso);
	}

	const Configuracion = require('global/configuracion');

	
	global.config = await Configuracion(process.env.F3_CONFIG_FILE || 'config.json');
	global.config.pid.escribirFicheroPid();

	global.logger = require('global/logger');

	global.logger.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');

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

