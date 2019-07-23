'use strict';
global.BASE = __dirname + '/';
const BASE = global.BASE;
process.title = 'fedicom3-core';


require(BASE + 'util/nativeExtensions');
//console.log('\033c');

const errCode = require(BASE + 'model/exitCodes');
global.serverVersion = '0.2.2';
global.protocolVersion = '3.3.5';
global.instanceID = require('os').hostname() + '-' + process.pid + '-' + Date.timestamp() + '-' + global.serverVersion;
global.config = require(BASE + 'config');
global.logger = require(BASE + 'util/logger');


const L = global.logger;


L.i('**** ARRANCANDO CONCENTRADOR FEDICOM 3 - ' + global.serverVersion + ' ****');
L.i('*** Implementando protololo Fedicom v' + global.protocolVersion + ' ****');
L.i('*** ID de instancia: ' + global.instanceID );

const fs = require('fs');
const http = require('http');
const https = require('https');
var httpConf = global.config.http;
var httpsConf = global.config.https;

try {
	httpsConf.ssl = {
	    key: fs.readFileSync(httpsConf.key || './ssl/server.key'),
	    cert: fs.readFileSync(httpsConf.cert  || './ssl/server.crt'),
		 passphrase: httpsConf.passphrase || ''
	};
} catch (ex) {
	L.f("Ocurrió un error al cargar el material criptográfico para HTTPS");
	L.f(ex);
	process.exit(errCode.E_KEY_OR_CERT_NOT_FOUND);
}

var app = require('express')();
var cors = require('cors');
app.use(cors({exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version']}));
app.disable('x-powered-by');
app.disable('etag');
app.use(require('body-parser').json({extended: true}));
app.use(require('express-bearer-token')());

// Carga de rutas
var routes = require(BASE + 'routes');
routes(app);

try {
	var server = http.createServer(app).listen(httpConf.port, function() {
		L.i("Servidor HTTP a la escucha en el puerto " + httpConf.port);
	}).on('error', function(err) {
		L.e("Ocurrió un error al arrancar el servicio HTTP");
	   L.e(err);
		process.exit(errCode.E_HTTP_SERVER_ERROR);
	});
} catch (ex) {
	L.f("Ocurrió un error al arrancar el servicio HTTP");
	L.f(ex);
	process.exit(errCode.E_HTTP_SERVER_ERROR);
}

try {
	var secureServer = https.createServer(httpsConf.ssl, app).listen(httpsConf.port, function() {
		L.i("Servidor HTTPS a la escucha en el puerto " + httpsConf.port);
	}).on('error', function(err) {
		L.e("Ocurrió un error al arrancar el servicio HTTPS");
	   L.e(err);
		process.exit(errCode.E_HTTP_SERVER_ERROR);
	});
} catch (ex) {
	L.f("Ocurrió un error al arrancar el servicio HTTPS");
	L.f(ex);
	process.exit(errCode.E_HTTPS_SERVER_ERROR);
}
