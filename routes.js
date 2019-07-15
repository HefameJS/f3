'use strict';
const BASE = global.BASE;

const FedicomError = require(BASE + 'model/fedicomError');
const Events = require(BASE + 'interfaces/events');
var MongoDB = require('mongodb');
var ObjectID = MongoDB.ObjectID;

const L = global.logger;

module.exports = function(app) {
  var authenticate = require(BASE + 'controllers/authenticate');
  var pedidos = require(BASE + 'controllers/pedidos');
  var controladorDevoluciones = require(BASE + 'controllers/devoluciones');



  /* Middleware que se ejecuta antes de buscar la ruta correspondiente.
   * Detecta errores comunes en las peticiones entrantes tales como:
   *  - Errores en el parseo del JSON entrante.
   */
  app.use(function (error, req, res, next) {
    if (error) {
		var txId = new ObjectID();
      req.txId = res.txId = txId;

		L.e( '** Recibiendo transmisión erronea ' + txId + ' desde ' + req.ip );
		L.xe( txId, ['** OCURRIO UN ERROR AL PARSEAR LA TRANSMISION Y SE DESCARTA', error] );

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
	  res.setHeader('X-TxID', txId);

	  L.i( '** Recibiendo transmisión ' + txId + ' desde ' + req.ip );
	  L.xt( txId, 'Iniciando procesamiento de la transmisión' );

    return next();
  });



  /* RUTAS */
	app.route('/authenticate')
		.post(authenticate.doAuth)
		.get(authenticate.verifyToken);

	app.route('/pedidos')
		.get(pedidos.getPedido)
		.post(pedidos.savePedido);

	app.route('/pedidos/:numeroPedido')
		.get(pedidos.getPedido);

	app.route('/devoluciones')
		.post(controladorDevoluciones.saveDevolucion);

	app.route('/devoluciones/:numeroDevolucion')
		.get(controladorDevoluciones.getDevolucion);


	app.route('/info').get(function (req, res) {

		res.status(200).json({
			version: "Trabajando sobre el documento v3.3.5 con los cambios hablados en la reunión del 11/07/2019",
			autenticacion: {
				1: 'Servicio de autenticación implementado y funcionando según norma Fedicom v3.3.5 (11/07/2019)',
			},
			pedidos: {
				1: 'En caso de faltas, no se están devolviendo los códigos de incidencia estandarizados en Fedicom3',
				2: 'No se van a proponer nunca servicios demorados',
				3: 'Cuando falta alguno de los campos "codigoArticulo" o "cantidad" en una línea de pedido no se controla bien la respuesta',
				4: 'Se ignora el campo "condicion" en las líneas de pedidos',
				5: 'Se ignora el campo "fechaServicio" en la cabecera',
				6: 'Cuando se envía una línea con "valeEstupefaciente", en la respuesta este campo no aparece',
				7: 'El "orden" de las líneas de pedido no se está respetando correctamente'
			},
			devoluciones: {
				1: 'Servicio de creación de devoluciones implementado y funcionando según norma Fedicom v3.3.5 (11/07/2019). Los motivos 01 (caducidad) y 02 (alerta sanitaria) ya no requiren indicar albarán',
				2: 'Servicio de consulta de devoluciones NO implementado'
			},
			albaranes: {
				1: 'ESTA FUNCIONALIDAD NO ESTA IMPLEMENTADA'
			},
			facturas: {
				1: 'ESTA FUNCIONALIDAD NO ESTA IMPLEMENTADA'
			},
			confirmacionAlbaran: {
				1: 'ESTA FUNCIONALIDAD NO ESTA IMPLEMENTADA'
			}

		});

	});


  /* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
  app.use(function(req, res, next) {

    L.xw( req.txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe' );
    var fedicomError = new FedicomError('HTTP-404', 'No existe el endpoint indicado.', 404);
    var responseBody = fedicomError.send(res);
    Events.emitDiscard(req, res, responseBody, null);

    return;
  });

};
