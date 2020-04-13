'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;


const FedicomError = require(BASE + 'model/fedicomError');
const Events = require(BASE + 'interfaces/events');
const ExpressExtensions = require(BASE + 'util/expressExtensions');


const tryCatch = require(BASE + 'routes/tryCatchWrapper');


module.exports = function (app) {

	var controladores = {
		autenticacion: require(BASE + 'controllers/controladorAutenticacion'),
		pedidos: require(BASE + 'controllers/controladorPedidos'),
		devoluciones: require(BASE + 'controllers/controladorDevoluciones'),
		albaranes: require(BASE + 'controllers/controladorAlbaranes'),
		confirmacionPedido: require(BASE + 'controllers/controladorConfirmacionPedido'),
		retransmision: require(BASE + 'controllers/controladorRetransmision'),
	}

	/* Middleware que se ejecuta antes de buscar la ruta correspondiente.
	 * Detecta errores comunes en las peticiones entrantes tales como:
	 *  - Errores en el parseo del JSON entrante.
	 */
	app.use(function (error, req, res, next) {
		if (error) {

			[req, res] = ExpressExtensions.extendReqAndRes(req, res);

			L.e('** Recibiendo transmisión erronea ' + req.txId + ' desde ' + req.originIp);
			L.xe(req.txId, ['** OCURRIO UN ERROR AL PARSEAR LA TRANSMISION Y SE DESCARTA', error]);

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

		L.i('** Recibiendo transmisión ' + req.txId + ' desde ' + req.originIp);
		L.xt(req.txId, 'Iniciando procesamiento de la transmisión');

		return next();
	});



	/* RUTAS */
	app.route('/authenticate')
		.post(tryCatch(controladores.autenticacion.autenticar))
		.get(tryCatch(controladores.autenticacion.verificarToken));


	app.route('/pedidos')
		.get(tryCatch(controladores.pedidos.consultaPedido))
		.post(tryCatch(controladores.pedidos.crearPedido))
		.put(tryCatch(controladores.pedidos.actualizarPedido));
	app.route('/pedidos/:numeroPedido')
		.get(tryCatch(controladores.pedidos.consultaPedido));


	app.route('/devoluciones')
		.get(tryCatch(controladores.devoluciones.consultaDevolucion))
		.post(tryCatch(controladores.devoluciones.crearDevolucion));
	app.route('/devoluciones/:numeroDevolucion')
		.get(tryCatch(controladores.devoluciones.consultaDevolucion));


	app.route('/albaranes')
		.get(tryCatch(controladores.albaranes.listadoAlbaranes));
	// app.route('/albaranes/confirmacion');
	app.route('/albaranes/:numeroAlbaran')
		.get(tryCatch(controladores.albaranes.consultaAlbaran));


	//app.route('/facturas')
	//	.get(controllers.facturas.findFacturas);
	//app.route('/facturas/:numeroFactura')
	//	.get(controllers.facturas.getFactura);


	/*
	 *	RUTAS NO STANDARD FEDICOM3
	 */
	app.route('/confirmaPedido')
		.post(tryCatch(controladores.confirmacionPedido.confirmaPedido));

	app.route('/retransmitir/:txId')
		.get(tryCatch(controladores.retransmision.retransmitePedido));


	/* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
	app.use(function (req, res, next) {
		L.xw(req.txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		var fedicomError = new FedicomError('HTTP-404', 'No existe el endpoint indicado.', 404);
		var responseBody = fedicomError.send(res);
		Events.emitDiscard(req, res, responseBody, null);

		return;
	});

};
