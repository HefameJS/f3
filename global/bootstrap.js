'use strict';

require('global/extensiones/extensionesDate');
require('global/extensiones/extensionesError');
const cluster = require('cluster');


module.exports = async function (tipoProceso) {

	global.K = {}
	global.C = {}
	global.L = {}
	global.M = {}

	const K = global.K;
	const L = global.L;
	const C = global.C;
	const M = global.M;


	// Inicialización de las constantes
	await require('global/constantes')();
	await require('global/configuracion')(process.env.F3_CONFIG_FILE || 'config.json');


	// ID de instancia del proceso actual
	process.tipo = tipoProceso;
	process.iid = require('os').hostname() + '-' + process.pid;
	if (cluster.isWorker) {
		process.worker = cluster.worker.id;
		process.titulo = K.PROCESOS.getTitulo(tipoProceso) + '-' + process.worker;
	} else {
		process.titulo = K.PROCESOS.getTitulo(tipoProceso);
	}


	// Cargamos configuracion basica
	C.pid.escribirFicheroPid();

	// Log global
	await require('global/log')(process.titulo);

	// Carga de datos del proceso
	L.info('Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker });
	L.info(`Servidor ${tipoProceso} v${K.VERSION.SERVIDOR} compilado el ${(new Date(K.VERSION.GIT.timestamp)).toString()} (GIT: ${K.VERSION.GIT.commit})`);
	process.on('uncaughtException', (excepcionNoControlada) => {
		L.dump(excepcionNoControlada);
		C.pid.borrarFicheroPid();
		process.exit(1);
	})
	process.on('exit', (code) => {
		C.pid.borrarFicheroPid();
		process.exit(code);
	});

	// Carga de MongoDB
	await require('global/mongodb')();

	

	// Al tener conexión a mongo, podemos cargar la configuración del clúster
	await C.cargarConfiguracionCluster();

	// Cachea los maestros
	const Maestro = require('./maestros/Maestro');
	Maestro.cachearMaestros();
}


