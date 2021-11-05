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
const TxMonListadoBalanceadores = require('controladores/monitor/balanceadores/TxMonListadoBalanceadores');
const TxMonConsultaBalanceador = require('controladores/monitor/balanceadores/TxMonConsultaBalanceador');
const TxMonActualizaBalanceador = require('controladores/monitor/balanceadores/TxMonActualizaBalanceador');
const TxMonConectividadSap = require('controladores/monitor/sap/TxMonConectividadSap');
const TxMonDestinosSap = require('controladores/monitor/sap/TxMonDestinosSap');
const TxMonPing = require('controladores/monitor/TxMonPing');
const TxMonConsultaDump = require('controladores/monitor/dumps/TxMonConsultaDump');




module.exports = (app) => {

	app.route('/~/ping').get(async (req, res) => {
		res.status(200).json({
			pong: true,
			fecha: new Date(),
			concentrador: K.HOSTNAME,
			balanceador: req?.headers?.['x-balanceador']?.toLowerCase?.() || null
		})
	})

	{ // TOKENS
		app.route('/~/token')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenObservador))
			.post(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenPermanente));
	}

	{ // INSTANCIAS 
		app.route('/~/instancias')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaInstancias));

		app.route('/~/instancias/:idInstancia')
			.delete(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonBorrarRegistroInstancia));
	}

	{ // MONGO DB
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
	}

	{ // BALANCEADORES DE CARGA
		app.route('/~/balanceadores')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonListadoBalanceadores));
		app.route('/~/balanceadores/:nombreBalanceador')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaBalanceador))
			.put(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonActualizaBalanceador));
	}

	{ // SAP
		app.route('/~/sap')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonDestinosSap));
		app.route('/~/sap/ping')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConectividadSap));
	}

	{ // PEDIDOS
		app.route('/~/consulta/pedidos')
			.put(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonListadoPedidos))
		app.route('/~/consulta/pedidos/:crc')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaPedido));
	}

	{ // TRANSMISIONES
		app.route('/~/consulta/transmisiones')
			.put(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonListadoTransmisiones));
		app.route('/~/consulta/transmisiones/:txId/:tipoConsulta?')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaTransmision));
	}

	{ // MAESTROS
		app.route('/~/maestro/:idMaestro/:idElemento?')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaMaestro));
	}

	{ // DUMPS
		app.route('/~/dumps/:servidor?/:idDump?')
			.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaDump));
	}

};
