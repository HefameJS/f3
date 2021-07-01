'use strict';
require('app-module-path').addPath(__dirname + '/..');

console.log('Inicializando Simulador Fedicom v3', new Date());

require('bootstrap')('simulador').then(async () => {


	const C = global.C;
	const L = global.L;

	// externas
	const express = require('express');
	const routerSap = require('SIMULADOR/routerSap');

	let app = express();
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(require('body-parser').json({ extended: true, limit: '5mb' }));

	// Carga de rutas
	routerSap(app);
	let puertoPruebas = 12000;

	let servidorHttp = app.listen(puertoPruebas)

	servidorHttp.on('error', (errorServidorHTTP) => {
		L.fatal('Ocurrió un error en el simulador SAP:', errorServidorHTTP);
		process.exit(1);
	});
	servidorHttp.on('listening', async () => {
		L.info(`Simulador SAP a la escucha en el puerto ${puertoPruebas}`);
		await require('./simularLlamadas')();
	});
	servidorHttp.on('close', () => { L.fatal("Se ha cerrado el simulador SAP"); });







});
