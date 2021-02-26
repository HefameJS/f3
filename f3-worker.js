'use strict';
require('app-module-path').addPath(__dirname);


console.log('Inicializando servicios Fedicom v3', new Date());

require('bootstrap')().then(() => {

	const C = global.config;
	const L = global.logger;
	const K = global.constants;

	// externas
	const cluster = require('cluster');
	const express = require('express');
	const cors = require('cors');

	const routerConcentrador = require('rutas/routerConcentrador');

	process.worker = cluster.worker.id;
	process.titulo = K.PROCESOS.TITULOS.WORKER + '-' + process.worker;
	process.tipo = K.PROCESOS.TIPOS.WORKER;
	C.pid.escribirFicheroPid();

	L.i(['Iniciado proceso', { tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker }], 'cluster');


	let app = express();
	app.use(cors({ exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version'] }));
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(require('body-parser').json({ extended: true, limit: '5mb' }));
	app.use(require('express-bearer-token')());

	// Carga de rutas
	routerConcentrador(app);

	let servidorHttp = app.listen(C.http.puertoConcentrador)

	servidorHttp.on('error', (errorServidorHTTP) => {
		L.f("Ocurrió un error en el servicio HTTP");
		L.f(errorServidorHTTP);
		process.exit(1);
	});
	servidorHttp.on('listening', () => { L.i("Servidor HTTP a la escucha en el puerto " + C.http.puertoConcentrador); });
	servidorHttp.on('close', () => { L.f("Se ha cerrado el servicio HTTP"); });
	//servidorHttp.on('connection', (socket) => {});


});

