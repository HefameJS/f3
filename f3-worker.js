'use strict';
require('app-module-path').addPath(__dirname);
global.constants = require('global/constantes');
const K = global.constants;

console.log('Inicializando servicios Fedicom v3', new Date());

require('bootstrap')(K.PROCESOS.TIPOS.WORKER).then(() => {

	const C = global.config;
	const L = global.logger;

	// externas
	const express = require('express');
	const cors = require('cors');

	const routerConcentrador = require('rutas/routerConcentrador');

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

	// 
	let refrescadorListaNegra = require('watchdog/refrescadorListaNegra');
	refrescadorListaNegra();


});

