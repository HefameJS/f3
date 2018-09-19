var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://proyman:87654321@hhub1.hefame.es:27017,hhub2.hefame.es:27017,hhub3.hefame.es:27017/proyman?replicaSet=rs0', { useNewUrlParser: true });

// Carga de modelos
// require('./api/models/pedidosModel');

var app = require('express')();
app.use(require('body-parser').json({extended: true}));
app.use(require('morgan')('dev'));

var port = process.env.PORT || 50000;
app.listen(port);

// Carga de rutas
var routes = require('./routes');
routes(app);


console.log('Concentrador Fedicom 3 - v0.0.1');
console.log('Escuchando en el puerto ' + port)
