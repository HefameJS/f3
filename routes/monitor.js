'use strict';
const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

const FedicomError = require(BASE + 'model/fedicomError');
const ExpressExtensions = require(BASE + 'util/expressExtensions');
const tryCatch = require(BASE + 'routes/tryCatchWrapper');



module.exports = function (app) {

	var controllers = {
		consultas: require(BASE + 'controllers/monitor/consultas')

	}

	/* Middleware que se ejecuta antes de buscar la ruta correspondiente.
	 * Detecta errores comunes en las peticiones entrantes tales como:
	 *  - Errores en el parseo del JSON entrante.
	 */
	app.use(function (error, req, res, next) {
		if (error) {
			[req, res] = ExpressExtensions.extendReqAndRes(req, res);

			L.e('** Recibiendo transmisión erronea ' + req.txId + ' desde ' + req.originIp);
			L.xe(req.txId, ['** OCURRIO UN ERROR AL PARSEAR LA TRANSMISION Y SE DESCARTA', error]);

			var fedicomError = new FedicomError(error);
			fedicomError.send(res);
		} else {
			next();
		}
	});


	app.use(function (req, res, next) {

		[req, res] = ExpressExtensions.extendReqAndRes(req, res);

		L.i('** Recibiendo transmisión ' + req.txId + ' desde ' + req.ip);
		L.xt(req.txId, 'Iniciando procesamiento de la transmisión');

		return next();
	});



	/* RUTAS */
	app.route('/query')
		.put(tryCatch(controllers.consultas.consultaTX))

	app.route('/status/proc')
		.get(tryCatch(controllers.consultas.procesos.consultaProcesos))

	app.route('/status/sap')
		.get(tryCatch(controllers.consultas.consultaSap))


	app.route('/status/mdb/col')
		.get(tryCatch(controllers.consultas.mongodb.getNombresColecciones))

	app.route('/status/mdb/col/:colName')
		.get(tryCatch(controllers.consultas.mongodb.getColeccion))

	app.route('/status/mdb/db')
		.get(tryCatch(controllers.consultas.mongodb.getDatabase))

	app.route('/status/mdb/op')
		.get(tryCatch(controllers.consultas.mongodb.getOperaciones))

	app.route('/status/mdb/rs')
		.get(tryCatch(controllers.consultas.mongodb.getReplicaSet))

	app.route('/status/mdb/log')
		.get(tryCatch(controllers.consultas.mongodb.getLogs))


	app.route('/status/apache/balanceadores')
		.get(tryCatch(controllers.consultas.apache.consultaBalanceadorApache))
		.put(tryCatch(controllers.consultas.apache.actualizaBalanceadorApache))

	/* Middleware que se ejecuta tras no haberse hecho matching con ninguna ruta. */
	app.use(function (req, res, next) {

		L.xw(req.txId, 'Se descarta la transmisión porque el endpoint [' + req.originalUrl + '] no existe');
		var fedicomError = new FedicomError('HTTP-404', 'No existe el endpoint indicado.', 404);
		fedicomError.send(res);

		return;
	});

};
