'use strict';


//const TransmisionError = require('controladores/transmisiones/TransmisionError');
//const ErrorFedicom = require('modelos/ErrorFedicom');
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const TxMonConsultaInstancias = require('controladores/monitor/TxMonConsultaInstancias');
const TxMonGenerarTokenObservador = require('controladores/monitor/TxMonGenerarTokenObservador');
const TxMonGenerarTokenPermanente = require('controladores/monitor/TxMonGenerarTokenPermanente');
const TxMonBorrarRegistroInstancia = require('controladores/monitor/TxMonBorrarRegistroInstancia');
const TxMonConsultaPedido = require('controladores/monitor/TxMonConsultaPedido');
const TxMonConsultaMaestro = require('controladores/monitor/TxMonConsultaMaestro');
const TxMonConsultaTransmision = require('controladores/monitor/TxMonConsultaTransmision');




module.exports = (app) => {

	// Middleware que se ejecuta antes de buscar la ruta correspondiente.
	// Detecta errores comunes en las peticiones entrantes tales como:
	//  - Errores en el parseo del JSON entrante.
	//app.use(async (errorExpress, req, res, next) => { errorExpress ? Transmision.ejecutar(req, res, TransmisionError, { errorExpress }) : next() });


	app.route('/~/token')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenObservador))
		.post(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonGenerarTokenPermanente));


	app.route('/~/instancias')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaInstancias));

	app.route('/~/instancias/:idInstancia')
		.delete(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonBorrarRegistroInstancia));


	app.route('/~/consulta/pedidos/:crc')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaPedido));

	app.route('/~/consulta/transmisiones/:txId/:tipoConsulta?')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaTransmision));


	app.route('/~/maestro/:idMaestro/:idElemento?')
		.get(async (req, res) => TransmisionLigera.ejecutar(req, res, TxMonConsultaMaestro));
	


	// RUTAS NUEVAS v1
	/*
		// Consulta de transmisiones
		app.route('/v1/transmisiones')
			.put(tryCatch(controladores.consultas.transmisiones.consultaTransmisiones));
	
		app.route('/v1/agregacion')
			.put(tryCatch(controladores.consultas.agregaciones.consultaAgregaciones));
	
		// Consulta de balanceadores de carga HTTP
		app.route('/v1/balanceadores')
			.get(tryCatch(controladores.consultas.balanceadores.listadoBalanceadores));	// ? [tipo=<tipo-proceso>]
	
		app.route('/v1/balanceadores/:servidor')
			.get(tryCatch(controladores.consultas.balanceadores.consultaBalanceador))
			.put(tryCatch(controladores.consultas.balanceadores.actualizaBalanceador));
	
		// Consulta de procesos registrados
		app.route('/v1/procesos')
			.get(tryCatch(controladores.consultas.procesos.listadoProcesos)); // ? [tipo=<tipo-proceso>] & [servidor=<host-proceso>]
	
		// MongoDB
		app.route('/v1/mongodb/colecciones')
			.get(tryCatch(controladores.consultas.mongodb.getNombresColecciones));
		app.route('/v1/mongodb/colecciones/:colName')
			.get(tryCatch(controladores.consultas.mongodb.getColeccion)); // ? [datosExtendidos=true]
		app.route('/v1/mongodb/database')
			.get(tryCatch(controladores.consultas.mongodb.getDatabase));
		app.route('/v1/mongodb/operaciones')
			.get(tryCatch(controladores.consultas.mongodb.getOperaciones));
		app.route('/v1/mongodb/replicaSet')
			.get(tryCatch(controladores.consultas.mongodb.getReplicaSet));
		app.route('/v1/mongodb/logs')
			.get(tryCatch(controladores.consultas.mongodb.getLogs)); // ? [tipo = (global | rs | startupWarnings)]
	
		// SQLite
		app.route('/v1/sqlite')
			.put(tryCatch(controladores.consultas.sqlite.consultaRegistros));
		app.route('/v1/sqlite/recuento')
			.get(tryCatch(controladores.consultas.sqlite.recuentoRegistros));
	
	
		// SAP
		app.route('/v1/sap/conexion')
			.get(tryCatch(controladores.consultas.sap.pruebaConexion));
		app.route('/v1/sap/destino')
			.get(tryCatch(controladores.consultas.sap.consultaDestino));
	
	
		// PRTG
		app.route('/v1/prtg/estadoPedidos')
			.get(tryCatch(controladores.consultas.prtg.consultaEstadoPedidos));
	
	
		// Consulta del maestro de constantes
		app.route('/v1/maestro')
			.get(tryCatch(controladores.consultas.maestro.consultaMaestro));
	
	
		// Dumps de procesos
		app.route('/v1/dumps')
			.get(tryCatch(controladores.consultas.dumps.listadoDumps));
	
		app.route('/v1/dumps/:idDump')
			.get(tryCatch(controladores.consultas.dumps.consultaDump));
	*/

	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	//app.use(async (req, res) => { Transmision.ejecutar(req, res, TransmisionError, { errorFedicom: new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404) }) });


};
