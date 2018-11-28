require('./util/nativeExtensions');
global.config = require('./config');

console.log('Concentrador Fedicom 3 - v0.0.1');


const fs = require('fs');
const http = require('http');
const https = require('https');
var httpConf = global.config.http;
var httpsConf = global.config.https;

httpsConf.ssl = {
    key: fs.readFileSync(httpsConf.key),
    cert: fs.readFileSync(httpsConf.cert),
	 passphrase: httpsConf.passphrase
};


var app = require('express')();
app.use(require('body-parser').json({extended: true}));
app.use(require('morgan')('dev'));
app.use(require('express-bearer-token')());

// Carga de rutas
var routes = require('./routes');
routes(app);

var server = http.createServer(app).listen(httpConf.port, function(){
  console.log("Servidor HTTP a la escucha en el puerto " + httpConf.port);
});

var secureServer = https.createServer(httpsConf.ssl, app).listen(httpsConf.port, function(){
  console.log("Servidor HTTPS a la escucha en el puerto " + httpsConf.port);
});
