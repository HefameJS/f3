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
const TxMonMongoReplicaSet = require('controladores/monitor/mongodb/TxMonMongoReplicaSet');
const TxMonMongoColeccion = require('controladores/monitor/mongodb/TxMonMongoColeccion');
const TxMonMongoBaseDatos = require('controladores/monitor/mongodb/TxMonMongoBaseDatos');
const TxMonMongoOperaciones = require('controladores/monitor/mongodb/TxMonMongoOperaciones');
const TxMonMongoLogs = require('controladores/monitor/mongodb/TxMonMongoLogs');
const TxMonBalanceador = require('controladores/monitor/balanceadores/TxMonListadoBalanceadores');
const TxMonListadoBalanceadores = require('controladores/monitor/balanceadores/TxMonListadoBalanceadores');
const TxMonConsultaBalanceador = require('controladores/monitor/balanceadores/TxMonConsultaBalanceador');




module.exports = (app) => {

	app.route('/~/token')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenObservador))
		.post(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenPermanente));


	app.route('/~/instancias')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaInstancias));

	app.route('/~/instancias/:idInstancia')
		.delete(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonBorrarRegistroInstancia));


	app.route('/~/mongodb')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonMongoReplicaSet));
	app.route('/~/mongodb/replicaset')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonMongoReplicaSet));
	app.route('/~/mongodb/coleccion/:coleccion?')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonMongoColeccion));
	app.route('/~/mongodb/basedatos')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonMongoBaseDatos));
	app.route('/~/mongodb/operaciones')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonMongoOperaciones));
	app.route('/~/mongodb/logs/:tipoLog?')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonMongoLogs));

	app.route('/~/balanceadores')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonListadoBalanceadores));
	app.route('/~/balanceadores/:nombreBalanceador')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaBalanceador));

		
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
