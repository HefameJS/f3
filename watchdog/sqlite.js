'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo');
const iSQLite = require(BASE + 'interfaces/isqlite');


var operationInProgress = false;
var rowsOnTheFly = 0;
var maxRetries = config.watchdog.sqlite.maxRetries || 10;

var interval = setInterval(function() {

	if (operationInProgress || rowsOnTheFly) return;

	operationInProgress = true;

	iSQLite.countTx(maxRetries, function (err, count) {
		if (err) {
			L.e(['Error al contar el número de entradas en base de datos de respaldo', err], 'sqlitewatch');
			operationInProgress = false;
			return;
		}

		if (count) {
			L.i(['Se encontraron entradas en la base de datos de respaldo - Procedemos a insertarlas en base de datos principal', count], 'sqlitewatch');

			iMongo.connectionStatus( (connected) => {
				if (!connected) {
					operationInProgress = false;
					L.w(['Aún no se ha restaurado la conexión con MongoDB']);
					return;
				}

				iSQLite.retrieveAll(maxRetries, function (error, rows) {
					if (error) {
						L.f(['error al obtener las entradas de la base de datos de respaldo', error], 'sqlitewatch');
						operationInProgress = false;
						return;
					}

					rowsOnTheFly = rows.length;

					rows.forEach( function (row) {

						iMongo.updateFromSqlite(JSON.parse(row.data), function (updated) {
							if (updated) {
								iSQLite.removeUid(row.uid, function (err, count) {
									rowsOnTheFly --;
								});
							} else {
								iSQLite.incrementUidRetryCount(row.uid, () => {});
								rowsOnTheFly --;
								// Log de cuando una entrada agota el número de transmisiones
								if (row.retryCount === maxRetries - 1) {
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

}, ((config.watchdog.sqlite.interval || 5) * 1000) );
