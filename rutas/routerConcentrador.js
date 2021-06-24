'use strict';

const ErrorFedicom = require('modelos/ErrorFedicom');

const Transmision = require('modelos/transmision/Transmision');
const TransmisionError = require('modelos/transmision/errores/TransmisionError');
const TransmisionAutenticacion = require('modelos/autenticacion/TransmisionAutenticacion');
const TransmisionCrearPedido = require('modelos/pedido/TransmisionCrearPedido');
const TransmisionConfirmarPedido = require('modelos/confirmarPedido/TransmisionConfirmarPedido');
const TransmisionConsultarPedido = require('modelos/pedido/TransmisionConsultarPedido');
const TransmisionCrearDevolucion = require('modelos/devolucion/TransmisionCrearDevolucion');
const TransmisionConsultarDevolucion = require('modelos/devolucion/TransmisionConsultarDevolucion');
const TransmisionCrearLogistica = require('modelos/logistica/TransmisionCrearLogistica');
const TransmisionConsultarAlbaran = require('modelos/albaran/TransmisionConsultarAlbaran');
const TransmisionBuscarAlbaranes = require('modelos/albaran/TransmisionBuscarAlbaranes');
const TransmisionConfirmarAlbaran = require('modelos/confirmarAlbaran/TransmisionConfirmarAlbaran');
const TransmisionConsultarLogistica = require('modelos/logistica/TransmisionConsultarLogistica');









module.exports = (app) => {

	// Middleware que se ejecuta antes de buscar la ruta correspondiente.
	// Detecta errores comunes en las peticiones entrantes tales como:
	//  - Errores en el parseo del JSON entrante.
	app.use(async (errorExpress, req, res, next) => {

		if (errorExpress) {
			Transmision.ejecutar(req, res, TransmisionError, {errorExpress})
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
	app.use(async (req, res, next) => {

		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		Transmision.ejecutar(req, res, TransmisionError, { errorFedicom });
	
	});

};
