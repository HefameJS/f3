'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo/iMongo');
const iSQLite = require(BASE + 'interfaces/isqlite/iSQLite');


var operationInProgress = false;
var rowsOnTheFly = 0;
const intentosMaximosDeEnvio = C.watchdog.sqlite.maxRetries || 10;

var interval = setInterval(() => {

	if (operationInProgress || rowsOnTheFly) return;

	operationInProgress = true;

	iSQLite.contarEntradas(intentosMaximosDeEnvio, (errorSQLite, numeroEntradas) => {
		if (errorSQLite) {
			L.e(['Error al contar el número de entradas en base de datos de respaldo', errorSQLite], 'sqlitewatch');
			operationInProgress = false;
			return;
		}

		if (numeroEntradas) {
			L.i(['Se encontraron entradas en la base de datos de respaldo - Procedemos a insertarlas en base de datos principal', numeroEntradas], 'sqlitewatch');

			iMongo.chequeaConexion((conectado) => {
				if (!conectado) {
					operationInProgress = false;
					L.w(['Aún no se ha restaurado la conexión con MongoDB'], 'sqlitewatch');
					return;
				}

				iSQLite.obtenerEntradas(intentosMaximosDeEnvio, (errorSQLite, entradas) => {
					if (errorSQLite) {
						L.f(['error al obtener las entradas de la base de datos de respaldo', errorSQLite], 'sqlitewatch');
						operationInProgress = false;
						return;
					}

					rowsOnTheFly = entradas.length;

					entradas.forEach((row) => {

						iMongo.transaccion.grabarDesdeSQLite(JSON.parse(row.data), (exito) => {
							if (exito) {
								iSQLite.eliminarEntrada(row.uid, (errorSQLite, numeroEntradasBorradas) => {
									rowsOnTheFly--;
								});
							} else {
								iSQLite.incrementarNumeroDeIntentos(row.uid, () => { });
								rowsOnTheFly--;
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
					operationInProgress = false;

				});
			});
		} else {
			L.t('No se encontraron entradas en la base de datos de respaldo', 'sqlitewatch');
			operationInProgress = false;
		}

	});

}, ((C.watchdog.sqlite.interval || 5) * 1000));
