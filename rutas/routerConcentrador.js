'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const Transmision = require('modelos/transmision/Transmision');
const TransmisionAutenticacion = require('modelos/autenticacion/TransmisionAutenticacion');
const TransmisionCrearPedido = require('modelos/pedido/TransmisionCrearPedido');
const TransmisionConfirmarPedido = require('modelos/confirmarPedido/TransmisionConfirmarPedido');
const TransmisionConsultarPedido = require('modelos/pedido/TransmisionConsultarPedido');

const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const { extenderSolicitudHttp } = require('global/extensiones/extensionesExpress');






module.exports = (app) => {

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
		} else {
			next();
		}
	});



	// Rutas estandard Fedicom v3
	app.route('/authenticate')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionAutenticacion));


	app.route('/pedidos')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionCrearPedido));
	//	.put(tryCatch(controladores.pedidos.actualizarPedido));
	app.route('/pedidos/:numeroPedido')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionConsultarPedido));

	app.route('/confirmaPedido')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionConfirmarPedido));


	/*
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
	
	
	
	
	//app.route('/retransmitir/:txId')
		//.get(tryCatch(controladores.retransmision.retransmitePedido));
	
	app.route('/logistica')
		.post(tryCatch(controladores.logistica.crearLogistica))
		.get(tryCatch(controladores.logistica.consultaLogistica));

	app.route('/logistica/:numeroLogistica')
		.get(tryCatch(controladores.logistica.consultaLogistica));
	*/

	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	app.use((req, res, next) => {
		let txId = req.txId;
		L.xw(txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
	});

};
