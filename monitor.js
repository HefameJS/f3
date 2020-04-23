'use strict';
require('app-module-path').addPath(__dirname);

require('globals');
const C = global.config;
const L = global.logger;
const K = global.constants;


process.title = K.PROCESS_TITLES.MONITOR;
process.type = K.PROCESS_TYPES.MONITOR;


global.instanceID += '-mon';
global.config = require('config');
global.logger = require('util/logger');

process.on('uncaughtException', (excepcionNoControlada) => {
	L.dump(excepcionNoControlada)
	process.exit(1)
})

L.i('**** ARRANCANDO MONITOR FEDICOM 3 - ' + K.SERVER_VERSION + ' ****');
L.i('*** Implementando protololo Fedicom v' + K.PROTOCOL_VERSION + ' ****');
L.i('*** ID de instancia: ' + global.instanceID);

const ficheroPID = (C.pid || '.') + '/' + process.title + '.pid';
require('fs').writeFile(ficheroPID, process.pid, (err) => {
	if (err) {
		L.e(["Error al escribir el fichero del PID", err]);
	}
});

const HTTP = require('http');
const configuracionHTTP = C.monitor.http;


let app = require('express')();
let cors = require('cors');
app.use(cors({ exposedHeaders: ['X-txId', 'Software-ID', 'Content-Api-Version'] }));
app.disable('x-powered-by');
app.disable('etag');
app.use(require('body-parser').json({ extended: true }));
app.use(require('express-bearer-token')());

// Carga de rutas
let rutasHTTP = require('routes/monitor');
rutasHTTP(app);


try {
	HTTP.createServer(app).listen(configuracionHTTP.port, () => {
		L.i("Servidor HTTP a la escucha en el puerto " + configuracionHTTP.port);
	}).on('error', (err) => {
		L.e("Ocurrió un error al arrancar el servicio HTTP");
		L.e(err);
		process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
	});
} catch (excepcionArranqueServidorHTTP) {
	L.f("Ocurrió un error al arrancar el servicio HTTP");
	L.f(excepcionArranqueServidorHTTP);
	process.exit(K.EXIT_CODES.E_HTTP_SERVER_ERROR);
}


require('interfaces/procesos/iRegistroProcesos').iniciarIntervaloRegistro();

