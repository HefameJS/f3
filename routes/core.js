'use strict';
const BASE = global.BASE;
const L = global.logger;
// const config = global.config;

const FedicomError = require(BASE + 'model/fedicomError');
const Events = require(BASE + 'interfaces/events');
const ExpressExtensions = require(BASE + 'util/expressExtensions');



module.exports = function(app) {

	var controllers = {
		authenticate: require(BASE + 'controllers/authenticate'),
  		pedidos: require(BASE + 'controllers/pedidos'),
		devoluciones: require(BASE + 'controllers/devoluciones'),
		albaranes: require(BASE + 'controllers/albaranes'),
  		confirmacionPedido: require(BASE + 'controllers/confirmacionPedido'),
		stats: require(BASE + 'controllers/stats')
	}

	/* Middleware que se ejecuta antes de buscar la ruta correspondiente.
	 * Detecta errores comunes en las peticiones entrantes tales como:
	 *  - Errores en el parseo del JSON entrante.
	 */
	app.use(function (error, req, res, next) {
		if (error) {

			[req, res] = ExpressExtensions.extendReqAndRes(req, res);

			L.e('** Recibiendo transmisión erronea ' + req.txId + ' desde ' + req.originIp );
			L.xe(req.txId, ['** OCURRIO UN ERROR AL PARSEAR LA TRANSMISION Y SE DESCARTA', error] );

			var fedicomError = new FedicomError(error);
			var responseBody = fedicomError.send(res);
			Events.emitDiscard(req, res, responseBody, error);
		} else {
			next();
		}
	});

	/**
	 * Generamos txId y añadimos cabeceras comunes.
	 * Tambien añadimos funcionalidades a req y res
	 */

	app.use(function (req, res, next) {

		[req, res] = ExpressExtensions.extendReqAndRes(req, res);

		L.i('** Recibiendo transmisión ' + req.txId + ' desde ' + req.originIp );
		L.xt(req.txId, 'Iniciando procesamiento de la transmisión' );

		return next();
	});



	/* RUTAS */
	app.route('/authenticate')
		.post(controllers.authenticate.doAuth)
		.get(controllers.authenticate.verifyToken);


	app.route('/pedidos')
		.get(controllers.pedidos.getPedido)
		.post(controllers.pedidos.savePedido)
		.put(controllers.pedidos.updatePedido);
	app.route('/pedidos/:numeroPedido')
		.get(controllers.pedidos.getPedido);


	app.route('/devoluciones')
		.get(controllers.devoluciones.getDevolucion)
		.post(controllers.devoluciones.saveDevolucion);
	app.route('/devoluciones/:numeroDevolucion')
		.get(controllers.devoluciones.getDevolucion);


	app.route('/albaranes')
		.get(controllers.albaranes.findAlbaran);
	// app.route('/albaranes/confirmacion');
	app.route('/albaranes/:numeroAlbaran')
		.get(controllers.albaranes.getAlbaran);


	//app.route('/facturas')
	//	.get(controllers.facturas.findFacturas);
	//app.route('/facturas/:numeroFactura')
	//	.get(controllers.facturas.getFactura);


	/*
	 *	RUTAS NO STANDARD FEDICOM3
	 */
	app.route('/confirmaPedido')
		.post(controllers.confirmacionPedido.confirmaPedido);

	app.route('/stats').get(controllers.stats.getStats);
	app.route('/stats/:item').get(controllers.stats.getStats);

	
	/* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
	app.use(function(req, res, next) {
		L.xw( req.txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe' );
		var fedicomError = new FedicomError('HTTP-404', 'No existe el endpoint indicado.', 404);
		var responseBody = fedicomError.send(res);
		Events.emitDiscard(req, res, responseBody, null);

		return;
	});

};
