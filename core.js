'use strict';
require('app-module-path').addPath(__dirname);

require('globals');
const C = global.config;
const L = global.logger;
const K = global.constants;


const cluster = require('cluster');

if (cluster.isMaster) {

	process.title = K.PROCESS_TITLES.CORE_MASTER;
	process.type = K.PROCESS_TYPES.CORE_MASTER;
	L.i('**** ARRANCANDO CONCENTRADOR FEDICOM 3 - ' + K.SERVER_VERSION + ' ****');
	L.i('*** Implementando protololo Fedicom v' + K.PROTOCOL_VERSION + ' ****');
	L.i('*** ID master: ' + global.instanceID, 'cluster');

	process.on('uncaughtException', (excepcionNoControlada) => {
		L.dump(excepcionNoControlada)
		process.exit(1)
	})


	const ficheroPID = (C.pid || '.') + '/' + process.title + '.pid';
	require('fs').writeFile(ficheroPID, process.pid, (errorFichero) => {
		if (errorFichero) {
			L.e(["Error al escribir el fichero del PID", errorFichero], 'cluster');
		}
	});


	const numeroWorkers = Math.max(parseInt(C.workers), 1) || (require('os').cpus().length - 1 || 1);
	L.i('** Lanzando ' + numeroWorkers + ' workers', 'cluster');
	for (let i = 0; i < numeroWorkers; i++) {
		cluster.fork();
	}

} else {

	process.title = K.PROCESS_TITLES.CORE_WORKER + '-' + cluster.worker.id;
	process.type = K.PROCESS_TYPES.CORE_WORKER;

	process.on('uncaughtException', (excepcionNoControlada) => {
		L.dump(excepcionNoControlada)
		process.exit(1)
	})

	L.i(['*** Iniciado worker', { instanceID: global.instanceID, pid: process.pid, workerID: cluster.worker.id }], 'cluster');

	const HTTP = require('http');
	let configuracionHTTP = C.http;


	let app = require('express')();
	let cors = require('cors');
	app.use(cors({ exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version'] }));
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(require('body-parser').json({ extended: true, limit: '5mb' }));
	app.use(require('express-bearer-token')());

	// Carga de rutas
	let rutasHTTP = require('routes/core');
	rutasHTTP(app);

	try {
		HTTP.createServer(app).listen(configuracionHTTP.port, () => {
			L.i("Servidor HTTP a la escucha en el puerto " + configuracionHTTP.port);
		}).on('error', (errorServidorHTTP) => {
			L.e("Ocurrió un error al arrancar el servicio HTTP");
			L.e(errorServidorHTTP);
			process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
		});
	} catch (excepcionArranqueServidorHTTP) {
		L.f("Ocurrió un error al arrancar el servicio HTTP");
		L.f(excepcionArranqueServidorHTTP);
		process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
	}


}



require('interfaces/procesos/iRegistroProcesos').iniciarIntervaloRegistro();


cluster.on('exit', (worker) => {
	L.f(['**** Un worker ha muerto. Lo levantamos de entre los muertos', worker.id], 'cluster');
	cluster.fork();
});
