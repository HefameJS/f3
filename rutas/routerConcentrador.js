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
const TransmisionCrearDevolucion = require('modelos/devolucion/TransmisionCrearDevolucion');
const TransmisionConsultarDevolucion = require('modelos/devolucion/TransmisionConsultarDevolucion');
const TransmisionCrearLogistica = require('modelos/logistica/TransmisionCrearLogistica');


const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const { extenderSolicitudHttp } = require('global/extensiones/extensionesExpress');
const TransmisionConsultarAlbaran = require('modelos/albaran/TransmisionConsultarAlbaran');
const TransmisionBuscarAlbaranes = require('modelos/albaran/TransmisionBuscarAlbaranes');
const TransmisionConfirmarAlbaran = require('modelos/confirmarAlbaran/TransmisionConfirmarAlbaran');
const TransmisionConsultarLogistica = require('modelos/logistica/TransmisionConsultarLogistica');








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


	
	app.route('/devoluciones')
	//	.get(tryCatch(controladores.devoluciones.consultaDevolucion))
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionCrearDevolucion));
	app.route('/devoluciones/:numeroDevolucion')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionConsultarDevolucion));
	
		
	app.route('/albaranes')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionBuscarAlbaranes));
	app.route('/albaranes/confirmacion')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionConfirmarAlbaran));
	app.route('/albaranes/:numeroAlbaran')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionConsultarAlbaran));

/*
	
	app.route('/facturas')
		.get(controladores.facturas.listadoFacturas);
	app.route('/facturas/:numeroFactura')
		.get(controladores.facturas.consultaFactura);
	
	
	
	
	//app.route('/retransmitir/:txId')
		//.get(tryCatch(controladores.retransmision.retransmitePedido));
	*/

	app.route('/logistica')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionCrearLogistica));

	app.route('/logistica/:numeroLogistica')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionConsultarLogistica));


	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	app.use((req, res, next) => {
		let txId = req.txId;
		L.xw(txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		let cuerpoRespuesta = errorFedicom.enviarRespuestaDeError(res);
	});

};
