'use strict';
require('app-module-path').addPath(__dirname);
console.log('Inicializando servicio de monitorización Fedicom v3', new Date());

require('global/bootstrap')('monitor').then(async () => {

	const C = global.C;
	const L = global.L;

	// externas
	const express = require('express');
	const cors = require('cors');

	const routerMonitor = require('controladores/rutas/rutasMonitor');
	const routerConcentrador = require('controladores/rutas/rutasEstandar');

	let app = express();
	app.use(cors({ exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version'] }));
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(require('body-parser').json({ extended: true, limit: '5mb' }));
	app.use(require('express-bearer-token')());

	// Carga de rutas

	routerMonitor(app);
	routerConcentrador(app);

	let servidorHttp = app.listen(C.monitor.http.puerto)

	servidorHttp.on('error', (errorServidorHTTP) => {
		L.fatal('Ocurrió un error en el servicio HTTP:', errorServidorHTTP);
		process.exit(1);
	});
	servidorHttp.on('listening', () => {
		L.info(`Servidor HTTP a la escucha en el puerto ${C.monitor.http.puerto}`);
		//servidorHttp.on('connection', (socket) => {});
	});
	servidorHttp.on('close', () => { L.fatal("Se ha cerrado el servicio HTTP"); });

	// Arranque del servidor de WS
	const WS = require('global/websocket');
	WS.arrancarServicioInterior();
	WS.arrancarServicioExterior();

	
	

});

