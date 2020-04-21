'use strict';
require('./globals'); 
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;


var cluster = require('cluster');

if (cluster.isMaster) {

	process.title = K.PROCESS_TITLES.CORE_MASTER;
	process.type = K.PROCESS_TYPES.CORE_MASTER;
	L.i('**** ARRANCANDO CONCENTRADOR FEDICOM 3 - ' + K.SERVER_VERSION + ' ****');
	L.i('*** Implementando protololo Fedicom v' + K.PROTOCOL_VERSION + ' ****');
	L.i('*** ID master: ' + global.instanceID , 'cluster');

	process.on('uncaughtException', (err) => {
		L.dump(err)
		process.exit(1)
	})


	var pidFile = (C.pid || '.') + '/' + process.title + '.pid';
	require('fs').writeFile(pidFile, process.pid, (err) => {
	    if(err) {
	        L.e(["Error al escribir el fichero del PID", err], 'cluster');
	    }
	});


	var workerCount = Math.max(parseInt(C.workers), 1) || (require('os').cpus().length - 1 || 1);
	L.i('** Lanzando ' + workerCount + ' workers', 'cluster');
	for (var i = 0; i < workerCount; i ++) {
		 cluster.fork();
	}

} else {

	process.title = K.PROCESS_TITLES.CORE_WORKER + '-' + cluster.worker.id;
	process.type = K.PROCESS_TYPES.CORE_WORKER;

	process.on('uncaughtException', (err) => {
		L.dump(err)
		process.exit(1)
	})

	L.i(['*** Iniciado worker', {instanceID: global.instanceID, pid: process.pid, workerID: cluster.worker.id}], 'cluster');

	const http = require('http');
	var httpConf = C.http;


	var app = require('express')();
	var cors = require('cors');
	app.use(cors({exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version']}));
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(require('body-parser').json({extended: true, limit: '5mb'}));
	app.use(require('express-bearer-token')());

	// Carga de rutas
	var routes = require(BASE + 'routes/core');
	routes(app);

	try {
		var server = http.createServer(app).listen(httpConf.port, () => {
			L.i("Servidor HTTP a la escucha en el puerto " + httpConf.port);
		}).on('error', (err) => {
			L.e("Ocurrió un error al arrancar el servicio HTTP");
		   L.e(err);
			process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
		});
	} catch (ex) {
		L.f("Ocurrió un error al arrancar el servicio HTTP");
		L.f(ex);
		process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
	}

	
}



require(BASE + 'interfaces/procesos/iRegistroProcesos').iniciarIntervaloRegistro();


cluster.on('exit', (worker) => {

	L.f(['**** Un worker ha muerto. Lo levantamos de entre los muertos', worker.id], 'cluster');

    cluster.fork();

});
