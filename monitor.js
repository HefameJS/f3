'use strict';
require('./globals');
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;


process.title = K.PROCESS_TITLES.MONITOR;
process.type = K.PROCESS_TYPES.MONITOR;


global.instanceID += '-mon';
global.config = require(BASE + 'config');
global.logger = require(BASE + 'util/logger');

process.on('uncaughtException', function (err) {
	L.dump(err)
	process.exit(1)
})

L.i('**** ARRANCANDO MONITOR FEDICOM 3 - ' + K.SERVER_VERSION + ' ****');
L.i('*** Implementando protololo Fedicom v' + K.PROTOCOL_VERSION + ' ****');
L.i('*** ID de instancia: ' + global.instanceID );

var pidFile = (C.pid || '.') + '/' + process.title + '.pid';
require('fs').writeFile(pidFile, process.pid, function(err) {
	 if(err) {
		  L.e(["Error al escribir el fichero del PID",err]);
	 }
});

const fs = require('fs');
const http = require('http');
const https = require('https');
var httpsConf = C.monitor.https;
var httpConf = C.monitor.http;

try {
	httpsConf.ssl = {
	    key: fs.readFileSync(httpsConf.key || './ssl/server.key'),
	    cert: fs.readFileSync(httpsConf.cert  || './ssl/server.crt'),
		 passphrase: httpsConf.passphrase || ''
	};
} catch (ex) {
	L.f("Ocurrió un error al cargar el material criptográfico para HTTPS");
	L.f(ex);
	process.exit(K.EXIT_CODES.E_KEY_OR_CERT_NOT_FOUND);
}

var app = require('express')();
var cors = require('cors');
app.use(cors({exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version']}));
app.disable('x-powered-by');
app.disable('etag');
app.use(require('body-parser').json({extended: true}));
app.use(require('express-bearer-token')());

// Carga de rutas
var routes = require(BASE + 'routes/monitor');
routes(app);

try {
	var secureServer = https.createServer(httpsConf.ssl, app).listen(httpsConf.port, function() {
		L.i("Servidor HTTPS a la escucha en el puerto " + httpsConf.port);
	}).on('error', function(err) {
		L.e("Ocurrió un error al arrancar el servicio HTTPS");
	   L.e(err);
		process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
	});
} catch (ex) {
	L.f("Ocurrió un error al arrancar el servicio HTTPS");
	L.f(ex);
	process.exit(K.EXIT_CODES.E_HTTPS_SERVER_ERROR);
}



try {
	var server = http.createServer(app).listen(httpConf.port, function () {
		L.i("Servidor HTTP a la escucha en el puerto " + httpConf.port);
	}).on('error', function (err) {
		L.e("Ocurrió un error al arrancar el servicio HTTP");
		L.e(err);
		process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
	});
} catch (ex) {
	L.f("Ocurrió un error al arrancar el servicio HTTP");
	L.f(ex);
	process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
}


require(BASE + 'util/processRegister').iniciarIntervaloRegistro();

