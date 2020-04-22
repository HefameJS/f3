'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require(BASE + 'model/ModeloErrorFedicom');

// Helpers
const extensionesExpress = require(BASE + 'util/extensionesExpress');
const tryCatch = require(BASE + 'routes/tryCatchWrapper');



module.exports = (app) => {

	const controladores = {
		consultas: require(BASE + 'controllers/monitor/controladorConsultas')

	}

	/* Middleware que se ejecuta antes de buscar la ruta correspondiente.
	 * Detecta errores comunes en las peticiones entrantes tales como:
	 *  - Errores en el parseo del JSON entrante.
	 */
	app.use((errorExpress, req, res, next) => {
		if (errorExpress) {
			[req, res] = extensionesExpress.extenderSolicitudHttp(req, res);
			let txId = req.txId;

			L.e('** Recibiendo transmisión erronea ' + txId + ' desde ' + req.originIp);
			L.xe(txId, ['** OCURRIO UN ERROR AL PARSEAR LA TRANSMISION Y SE DESCARTA', errorExpress]);

			let errorFedicom = new ErrorFedicom(errorExpress);
			errorFedicom.enviarRespuestaDeError(res);
		} else {
			next();
		}
	});


	app.use((req, res, next) => {
		[req, res] = extensionesExpress.extenderSolicitudHttp(req, res);
		let txId = req.txId;

		L.i('** Recibiendo transmisión ' + txId + ' desde ' + req.ip);
		L.xt(txId, 'Iniciando procesamiento de la transmisión');

		next();
	});



	/* RUTAS */
	app.route('/query')
		.put(tryCatch(controladores.consultas.consultaTransmisiones))

	app.route('/status/proc')
		.get(tryCatch(controladores.consultas.procesos.consultaProcesos))

	app.route('/status/sap')
		.get(tryCatch(controladores.consultas.sap.consultaSap))


	app.route('/status/mdb/col')
		.get(tryCatch(controladores.consultas.mongodb.getNombresColecciones))

	app.route('/status/mdb/col/:colName')
		.get(tryCatch(controladores.consultas.mongodb.getColeccion))

	app.route('/status/mdb/db')
		.get(tryCatch(controladores.consultas.mongodb.getDatabase))

	app.route('/status/mdb/op')
		.get(tryCatch(controladores.consultas.mongodb.getOperaciones))

	app.route('/status/mdb/rs')
		.get(tryCatch(controladores.consultas.mongodb.getReplicaSet))

	app.route('/status/mdb/log')
		.get(tryCatch(controladores.consultas.mongodb.getLogs))


	app.route('/status/apache/balanceadores')
		.get(tryCatch(controladores.consultas.apache.consultaBalanceadorApache))
		.put(tryCatch(controladores.consultas.apache.actualizaBalanceadorApache))

	app.route('/status/cache/credenciales')
		.get(tryCatch(controladores.consultas.cache.getEstadoCacheCredenciales))

	app.route('/status/sqlite')
		.get(tryCatch(controladores.consultas.sqlite.getEstadoSQLite))

	/* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
	app.use((req, res, next) => {
		let txId = req.txId;

		L.xw(txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		let errorFedicom = new ErrorFedicom('HTTP-404', 'No existe el endpoint indicado.', 404);
		errorFedicom.enviarRespuestaDeError(res);

	});

};
