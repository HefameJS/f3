'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iSQLite = require('interfaces/isqlite/iSQLite');


let hayOperacionesEnProceso = false;
let numeroOperacionesEnEjecucion = 0;
const intentosMaximosDeEnvio = C.watchdog.sqlite.maxRetries || 10;

/*let interval = */
setInterval(() => {

	if (hayOperacionesEnProceso || numeroOperacionesEnEjecucion) return;

	hayOperacionesEnProceso = true;

	iSQLite.contarEntradas(intentosMaximosDeEnvio, (errorSQLite, numeroEntradas) => {
		if (errorSQLite) {
			L.e(['Error al contar el número de entradas en base de datos de respaldo', errorSQLite], 'sqlitewatch');
			hayOperacionesEnProceso = false;
			return;
		}

		if (numeroEntradas) {
			L.i(['Se encontraron entradas en la base de datos de respaldo - Procedemos a insertarlas en base de datos principal', numeroEntradas], 'sqlitewatch');

			iMongo.chequeaConexion((conectado) => {
				if (!conectado) {
					hayOperacionesEnProceso = false;
					L.w(['Aún no se ha restaurado la conexión con MongoDB'], 'sqlitewatch');
					return;
				}

				iSQLite.obtenerEntradas(intentosMaximosDeEnvio, (errorSQLite, entradas) => {
					if (errorSQLite) {
						L.f(['error al obtener las entradas de la base de datos de respaldo', errorSQLite], 'sqlitewatch');
						hayOperacionesEnProceso = false;
						return;
					}

					numeroOperacionesEnEjecucion = entradas.length;

					entradas.forEach((row) => {

						iMongo.transaccion.grabarDesdeSQLite(row.data, (exito) => {
							if (exito) {
								iSQLite.eliminarEntrada(row.uid, (errorSQLite, numeroEntradasBorradas) => {
									numeroOperacionesEnEjecucion--;
								});
							} else {
								iSQLite.incrementarNumeroDeIntentos(row.uid, () => { });
								numeroOperacionesEnEjecucion--;
								// Log de cuando una entrada agota el número de transmisiones
								if (row.retryCount === intentosMaximosDeEnvio - 1) {
									row.retryCount++;
									L.f(['Se ha alcanzado el número máximo de retransmisiones para la entrada', row], 'sqlitewatch');
								} else {
									L.e(['Ocurrió un error al insertar la entrada en MDB. Se reintentará mas tarde.', row], 'sqlitewatch')
								}
							}
						});

					});
					hayOperacionesEnProceso = false;

				});
			});
		} else {
			L.t('No se encontraron entradas en la base de datos de respaldo', 'sqlitewatch');
			hayOperacionesEnProceso = false;
		}

	});

}, ((C.watchdog.sqlite.interval || 5) * 1000));
