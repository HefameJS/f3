'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iEventos = require('interfaces/eventos/iEventos');
const iFlags = require('interfaces/iflags/iFlags');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const { extenderSolicitudHttp, tryCatch } = require('global/extensiones/extensionesExpress');



module.exports = (app) => {


	const controladores = {
		autenticacion: require('controladores/controladorAutenticacion'),
		pedidos: require('controladores/controladorPedidos'),
		confirmacionPedido: require('controladores/controladorConfirmacionPedido'),
		devoluciones: require('controladores/controladorDevoluciones'),
		albaranes: require('controladores/controladorAlbaranes'),
		facturas: require('controladores/controladorFacturas'),
		retransmision: require('controladores/controladorRetransmision'),
		logistica: require('controladores/controladorLogistica'),
	}

	app.route('/ping').get((req, res) => {
		res.status(200).json({ok: true})
	})

	// Middleware que se ejecuta antes de buscar la ruta correspondiente.
	// Detecta errores comunes en las peticiones entrantes tales como:
	//  - Errores en el parseo del JSON entrante.
	app.use((errorExpress, req, res, next) => {
		if (errorExpress) {

			[req, res] = extenderSolicitudHttp(req, res);
			let txId = req.txId;

			L.w('Se recibe transmisión erronea ' + txId + ' desde ' + req.obtenerDireccionIp());
			L.xw(txId, ['Se descarta la transmisión por ser errónea', errorExpress]);

			let errorFedicom = new ErrorFedicom(errorExpress);
			let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
			iEventos.descartar(req, res, cuerpoRespuesta, errorExpress);
		} else {
			next();
		}
	});

	// Generamos txId y añadimos cabeceras comunes.
	// Tambien añadimos funcionalidades a req y res
	app.use((req, res, next) => {

		[req, res] = extenderSolicitudHttp(req, res);
		let txId = req.txId;

		L.i('Recibiendo transmisión ' + txId + ' desde ' + req.obtenerDireccionIp());
		L.xt(txId, 'Iniciando procesamiento de la transmisión');

		iFlags.transmision.generaFlags(req);

		next();
	});



	// Rutas estandard Fedicom v3

	app.route('/authenticate')
		.post(tryCatch(controladores.autenticacion.autenticar))
		.get(tryCatch(controladores.autenticacion.verificarToken));


	app.route('/pedidos')
		.get(tryCatch(controladores.pedidos.consultaPedido))
		.post(tryCatch(controladores.pedidos.crearPedido))
		.put(tryCatch(controladores.pedidos.actualizarPedido));
	app.route('/pedidos/:numeroPedido')
		.get(tryCatch(controladores.pedidos.consultaPedido));

	app.route('/confirmaPedido')
		.post(tryCatch(controladores.confirmacionPedido.confirmaPedido));


	
	app.route('/devoluciones')
		.get(tryCatch(controladores.devoluciones.consultaDevolucion))
		.post(tryCatch(controladores.devoluciones.crearDevolucion));
	app.route('/devoluciones/:numeroDevolucion')
		.get(tryCatch(controladores.devoluciones.consultaDevolucion));

		
	app.route('/albaranes')
		.get(tryCatch(controladores.albaranes.listadoAlbaranes));
	app.route('/albaranes/confirmacion')
		.post(tryCatch(controladores.albaranes.confirmacionAlbaran));
	app.route('/albaranes/:numeroAlbaran')
		.get(tryCatch(controladores.albaranes.consultaAlbaran));


	
	app.route('/facturas')
		.get(controladores.facturas.listadoFacturas);
	app.route('/facturas/:numeroFactura')
		.get(controladores.facturas.consultaFactura);
	
	
	
	
	app.route('/retransmitir/:txId')
		.get(tryCatch(controladores.retransmision.retransmitePedido));
	
	app.route('/logistica')
		.post(tryCatch(controladores.logistica.crearLogistica))
		.get(tryCatch(controladores.logistica.consultaLogistica));

	app.route('/logistica/:numeroLogistica')
		.get(tryCatch(controladores.logistica.consultaLogistica));


	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	app.use((req, res, next) => {
		let txId = req.txId;
		L.xw(txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
		iEventos.descartar(req, res, cuerpoRespuesta);
	});

};
