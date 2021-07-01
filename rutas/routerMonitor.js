'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const { extenderSolicitudHttp, tryCatch } = require('global/extensiones/extensionesExpress');



module.exports = (app) => {

	const controladores = {
		consultas: require('controladores/monitor/controladorConsultas')
	}

	/* Middleware que se ejecuta antes de buscar la ruta correspondiente.
	 * Detecta errores comunes en las peticiones entrantes tales como:
	 *  - Errores en el parseo del JSON entrante.
	 */
	app.use((errorExpress, req, res, next) => {
		if (errorExpress) {

			[req, res] = extenderSolicitudHttp(req, res);
			let txId = req.txId;

			L.w('Se recibe transmisión erronea ' + txId + ' desde ' + req.obtenerDireccionIp());
			L.xw(txId, ['Se descarta la transmisión por ser errónea', errorExpress]);

			let errorFedicom = new ErrorFedicom(errorExpress);
			errorFedicom.enviarRespuestaDeError(res);
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

		next();
	});


	// RUTAS NUEVAS v1

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

	/*
		// Dumps de procesos
		app.route('/v1/dumps')
			.get(tryCatch(controladores.consultas.dumps.listadoDumps));
	
		app.route('/v1/dumps/:idDump')
			.get(tryCatch(controladores.consultas.dumps.consultaDump));
	*/

	// Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta.
	app.use((req, res, next) => {
		let txId = req.txId;
		L.xw(txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		errorFedicom.enviarRespuestaDeError(res);
	});


};
