
'use strict';

const FedicomError = require('./model/fedicomError');
const Events = require('./interfaces/events');
var MongoDB = require('mongodb');
var ObjectID = MongoDB.ObjectID;

const L = global.logger;

module.exports = function(app) {
  var authenticate = require('./controllers/authenticate');
  var pedidos = require('./controllers/pedidos');



  /* Middleware que se ejecuta antes de buscar la ruta correspondiente.
   * Detecta errores comunes en las peticiones entrantes tales como:
   *  - Errores en el parseo del JSON entrante.
   */
  app.use(function (error, req, res, next) {
    if (error) {
		var txId = new ObjectID();
      req.txId = res.txId = txId;

		L.e( '** Recibiendo petición erronea ' + txId + ' desde ' + req.ip );
		L.xe( txId, ['** OCURRIO UN ERROR AL PARSEAR LA PETICION Y SE DESCARTA', error] );

      var fedicomError = new FedicomError(error);
      var responseBody = fedicomError.send(res);
      Events.emitDiscard(req, res, responseBody, error);
    } else {
      next();
    }
  });


  app.use(function (req, res, next) {
	  var txId = new ObjectID();
	  req.txId = res.txId = txId;

	  L.i( '** Recibiendo petición ' + txId + ' desde ' + req.ip );
	  L.xt( txId, 'Iniciando procesamiento de la petición' );

    return next();
  });



  /* RUTAS */
	app.route('/authenticate')
		.post(authenticate.doAuth)
		.get(authenticate.verifyToken);

	app.route('/pedidos')
		.post(pedidos.savePedido)




  /* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
  app.use(function(req, res, next) {

    L.xw( req.txId, 'Se descarta la petición porque el endpoint [' + req.originalUrl + '] no existe' );
    var fedicomError = new FedicomError('CORE-404', 'No existe el endpoint indicado.', 404);
    var responseBody = fedicomError.send(res);
    Events.emitDiscard(req, res, responseBody, null);

    return;
  });

};
