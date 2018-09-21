
'use strict';

const FedicomError = require('./model/FedicomError');

module.exports = function(app) {
  var authenticate = require('./controllers/authenticate');

  /* Middleware que se ejecuta antes de buscar la ruta correspondiente.
   * Detecta errores comunes en las peticiones entrantes tales como:
   *  - Errores en el parseo del JSON entrante.
   */
  app.use(function (error, req, res, next) {
    if (error) {
      var fedicomError = new FedicomError(error);
      return fedicomError.send(res);
    }
    else {
      next();
    }
  });

  /* RUTAS */
  app.route('/authenticate')
    .post(authenticate.doAuth)
    .get(authenticate.verifyToken);






  /* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
  app.use(function(req, res, next) {
    var fedicomError = new FedicomError('CORE-404', 'No existe el endpoint indicado.', 404);
    return fedicomError.send(res);
  });

};
