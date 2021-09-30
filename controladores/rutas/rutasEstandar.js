'use strict';

const ErrorFedicom = require('modelos/ErrorFedicom');

const Transmision = require('modelos/transmision/Transmision');
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const TransmisionError = require('controladores/transmisiones/TransmisionError');

const TransmisionAutenticacion = require('controladores/transmisiones/autenticacion/TransmisionAutenticacion');

const TransmisionCrearPedido = require('controladores/transmisiones/pedido/TransmisionCrearPedido');
const TransmisionConfirmarPedido = require('controladores/transmisiones/pedido/TransmisionConfirmarPedido');
const TransmisionConsultarPedido = require('controladores/transmisiones/pedido/TransmisionConsultarPedido');

const TransmisionCrearDevolucion = require('controladores/transmisiones/devoluciones/TransmisionCrearDevolucion');
const TransmisionConsultarDevolucion = require('controladores/transmisiones/devoluciones/TransmisionConsultarDevolucion');

const TransmisionCrearLogistica = require('controladores/transmisiones/logistica/TransmisionCrearLogistica');
const TransmisionConsultarLogistica = require('controladores/transmisiones/logistica/TransmisionConsultarLogistica');

const TransmisionConsultarAlbaran = require('controladores/transmisiones/albaranes/TransmisionConsultarAlbaran');
const TransmisionBuscarAlbaranes = require('controladores/transmisiones/albaranes/TransmisionBuscarAlbaranes');
const TransmisionConfirmarAlbaran = require('controladores/transmisiones/albaranes/TransmisionConfirmarAlbaran');

const TransmisionReejecutarPedido = require('controladores/retransmisiones/TransmisionReejecutarPedido');

const rutasMonitor = require('./rutasMonitor');


module.exports = (app) => {

	// Middleware que se ejecuta antes de buscar la ruta correspondiente.
	// Detecta errores comunes en las peticiones entrantes tales como:
	//  - Errores en el parseo del JSON entrante.
	app.use(async (errorExpress, req, res, next) => {
		if (errorExpress) {
			Transmision.ejecutar(req, res, TransmisionError, { errorExpress })
		} else {
			next();
		}
	});



	// Rutas estandard Fedicom v3
	app.route('/authenticate')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionAutenticacion));


	app.route('/pedidos')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionCrearPedido))
		.put(async (req, res) => { Transmision.ejecutar(req, res, TransmisionError, { errorFedicom: new ErrorFedicom('PED-ERR-999', 'El servicio de actualización de pedidos no está disponible.', 501) }); });
	app.route('/pedidos/:numeroPedido')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionConsultarPedido));
	app.route('/pedidos/reejecutar/:txId')
		.put(async (req, res) => TransmisionLigera.ejecutar(req, res, TransmisionReejecutarPedido));
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



	app.route('/facturas')
		.get(async (req, res) => { Transmision.ejecutar(req, res, TransmisionError, { errorFedicom: new ErrorFedicom('FACT-ERR-999', 'El servicio de consulta de facturas no está disponible.', 501) }); });
	app.route('/facturas/:numeroFactura')
		.get(async (req, res) => { Transmision.ejecutar(req, res, TransmisionError, { errorFedicom: new ErrorFedicom('FACT-ERR-999', 'El servicio de consulta de facturas no está disponible.', 501) }) });


	app.route('/logistica')
		.post(async (req, res) => Transmision.ejecutar(req, res, TransmisionCrearLogistica));
	app.route('/logistica/:numeroLogistica')
		.get(async (req, res) => Transmision.ejecutar(req, res, TransmisionConsultarLogistica));



	rutasMonitor(app);


	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	app.use(async (req, res) => { Transmision.ejecutar(req, res, TransmisionError, { errorFedicom: new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404) }) });

};
