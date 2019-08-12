'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;
const sqlitewatchConfig = config.watchdog.sqlite;

const Imongo = require(BASE + 'interfaces/imongo');
const Isqlite = require(BASE + 'interfaces/isqlite');
const Events = require(BASE + 'interfaces/events');
const ObjectID = Imongo.ObjectID;


var operationInProgress = false;
var rowsOnTheFly = 0;

var interval = setInterval(function() {

	if (operationInProgress || rowsOnTheFly) return;


	operationInProgress = true;

	Isqlite.countTx( function (err, count) {
		if (err) {
			L.e(['Error al contar el número de entradas en base de datos de respaldo', err], 'sqlitewatch');
			operationInProgress = false;
			return;
		}

		if (count) {
			L.i(['Se encontraron entradas en la base de datos de respaldo - Procedemos a insertarlas en base de datos principal', count], 'sqlitewatch');

			Isqlite.retrieveAll( function (error, rows) {
				if (error) {
					L.e(['error al obtener las entradas de la base de datos de respaldo', error], 'sqlitewatch');
					operationInProgress = false;
					return;
				}

				rowsOnTheFly = rows.length;

				rows.forEach( function (row) {

					Imongo.updateFromSqlite(JSON.parse(row.data), function (updated) {
						if (updated) {
							Isqlite.removeUid(row.uid, function (err, count) {
								rowsOnTheFly --;
							});
						} else {
							rowsOnTheFly --;
						}
					});

				});
				operationInProgress = false;

			});

		} else {
			// L.t('No se encontraron entradas en la base de datos de respaldo', 'sqlitewatch');
			operationInProgress = false;
		}

	});

}, (sqlitewatchConfig.interval * 1000) );
