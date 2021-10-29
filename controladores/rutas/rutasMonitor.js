'use strict';




const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const TxMonGenerarTokenObservador = require('controladores/monitor/tokens/TxMonGenerarTokenObservador');
const TxMonGenerarTokenPermanente = require('controladores/monitor/tokens/TxMonGenerarTokenPermanente');
const TxMonConsultaInstancias = require('controladores/monitor/instancias/TxMonConsultaInstancias');
const TxMonBorrarRegistroInstancia = require('controladores/monitor/instancias/TxMonBorrarRegistroInstancia');
const TxMonConsultaMaestro = require('controladores/monitor/maestros/TxMonConsultaMaestro');
const TxMonConsultaTransmision = require('controladores/monitor/transmisiones/TxMonConsultaTransmision');
const TxMonConsultaPedido = require('controladores/monitor/pedidos/TxMonConsultaPedido');
const TxMonListadoPedidos = require('controladores/monitor/pedidos/TxMonListadoPedidos');
const TxMonListadoTransmisiones = require('controladores/monitor/transmisiones/TxMonListadoTransmisiones');




module.exports = (app) => {

	app.route('/~/token')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenObservador))
		.post(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenPermanente));


	app.route('/~/instancias')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaInstancias));

	app.route('/~/instancias/:idInstancia')
		.delete(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonBorrarRegistroInstancia));


	app.route('/~/consulta/pedidos')
		.put(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonListadoPedidos))
	app.route('/~/consulta/pedidos/:crc')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaPedido));


	app.route('/~/consulta/transmisiones')
		.put(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonListadoTransmisiones));
	app.route('/~/consulta/transmisiones/:txId/:tipoConsulta?')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaTransmision));


	app.route('/~/maestro/:idMaestro/:idElemento?')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaMaestro));



};
