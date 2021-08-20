'use strict';
require('app-module-path').addPath(__dirname);
console.log('Inicializando Worker Fedicom v3', new Date());

require('global/bootstrap')('worker').then(() => {

	const C = global.C;
	const L = global.L;

	// externas
	const express = require('express');
	const cors = require('cors');

	const routerConcentrador = require('controladores/rutas/rutasEstandar');

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
		L.fatal('Ocurrió un error en el servicio HTTP:', errorServidorHTTP);
		process.exit(1);
	});
	servidorHttp.on('listening', () => {
		L.info(`Servidor HTTP a la escucha en el puerto ${C.http.puertoConcentrador}`);
		//servidorHttp.on('connection', (socket) => {});
	});
	servidorHttp.on('close', () => { L.fatal("Se ha cerrado el servicio HTTP"); });
});