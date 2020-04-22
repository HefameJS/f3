'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iEventos = require(BASE + 'interfaces/eventos/iEventos');

// Modelos
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');

// Helpers
const extensionesExpress = require(BASE + 'util/extensionesExpress');
const tryCatch = require('./tryCatchWrapper');


module.exports = (app) => {

	const controladores = {
		autenticacion: require(BASE + 'controllers/controladorAutenticacion'),
		pedidos: require(BASE + 'controllers/controladorPedidos'),
		devoluciones: require(BASE + 'controllers/controladorDevoluciones'),
		albaranes: require(BASE + 'controllers/controladorAlbaranes'),
		logistica: require(BASE + 'controllers/controladorLogistica'),
		confirmacionPedido: require(BASE + 'controllers/controladorConfirmacionPedido'),
		retransmision: require(BASE + 'controllers/controladorRetransmision'),
	}

	/* Middleware que se ejecuta antes de buscar la ruta correspondiente.
	 * Detecta errores comunes en las peticiones entrantes tales como:
	 *  - Errores en el parseo del JSON entrante.
	 */
	app.use((errorExpress, req, res, next) => {
		if (errorExpress) {
			
			[req, res] = extensionesExpress.extenderSolicitudHttp(req, res);
			let txId = req.txId;

			L.e('** Recibiendo transmisión erronea ' + txId + ' desde ' + req.originIp);
			L.xe(txId, ['** OCURRIO UN ERROR AL PARSEAR LA TRANSMISION Y SE DESCARTA', errorExpress]);

			let errorFedicom = new ErrorFedicom(errorExpress);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.descartar(req, res, cuerpoRespuesta, errorExpress);
		} else {
			next();
		}
	});

	/**
	 * Generamos txId y añadimos cabeceras comunes.
	 * Tambien añadimos funcionalidades a req y res
	 */

	app.use( (req, res, next) => {

		[req, res] = extensionesExpress.extenderSolicitudHttp(req, res);
		let txId = req.txId;

		L.i('** Recibiendo transmisión ' + txId + ' desde ' + req.originIp);
		L.xt(txId, 'Iniciando procesamiento de la transmisión');

		next();
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

	app.route('/logistica')
		.post(tryCatch(controladores.logistica.crearLogistica))
		.get(tryCatch(controladores.logistica.consultaLogistica));

	app.route('/logistica/:numeroLogistica')
		.get(tryCatch(controladores.logistica.consultaLogistica));


	/* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
	app.use((req, res, next) => {
		let txId = req.txId;
		L.xw(txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.descartar(req, res, cuerpoRespuesta, null);
	});

};
