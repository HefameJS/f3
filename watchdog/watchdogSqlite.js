'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Interfaces
const iMongo = require('interfaces/imongo/iMongo');
const iSQLite = require('interfaces/iSQLite');


let hayOperacionesEnProceso = false;
let numeroOperacionesEnEjecucion = 0;

module.exports = () => {

	let idIntervalo = setInterval(async () => {

		if (hayOperacionesEnProceso || numeroOperacionesEnEjecucion) return;

		hayOperacionesEnProceso = true;

		L.t(['Arrancando intervalo']);

		// Comprobacion de si hay entradas pendientes en SQLite
		let entradas;
		try {
			entradas = await iSQLite.obtenerEntradas(C.sqlite.maximoReintentos, C.sqlite.insercionesSimultaneas);
			if (!entradas || entradas.length === 0) {
				L.t('No se encontraron entradas en la base de datos de respaldo');
				hayOperacionesEnProceso = false;
				return;
			}
		} catch (errorSQLite) {
			L.e(['Error al obtener entradas de SQLite', errorSQLite], 'sqlitewatch');
			hayOperacionesEnProceso = false;
			return;
		}
		L.i(['Se encontraron entradas en la base de datos de respaldo', entradas.length], 'sqlitewatch');


		// Comprobamos si hay acceso a MongoDB
		try {
			let conectado = await iMongo.chequeaConexion();
			if (!conectado) {
				hayOperacionesEnProceso = false;
				L.w(['Aún no se ha restaurado la conexión con MongoDB'], 'sqlitewatch');
				return;
			}
		} catch (errorMongo) {
			hayOperacionesEnProceso = false;
			L.w(['Aún no se ha restaurado la conexión con MongoDB'], 'sqlitewatch');
			return;
		}


		// Reenviamos entradas
		entradas.forEach((row) => {
			numeroOperacionesEnEjecucion++;
			L.xi(row.txid, ['Insertando entrada en MongoDB desde SQLite', row.uid], 'sqlitewatch');

			iMongo.transaccion.grabarDesdeSQLite(row.data)
				.then(async (exito) => {
					if (exito) {
						L.xi(row.txid, ['La entrada se grabó con exito, procedemos a borrarla de SQLite', row.uid], 'sqlitewatch');
						iSQLite.eliminarEntrada(row.uid)
							.then((resultado) => L.xd(row.txid, ['Entrada borrada correctamente de SQLite', row.uid], 'sqlitewatch'))
							.catch((error) => L.xe(row.txid, ['Error al borrar la entrada', row.uid], 'sqlitewatch'))
							.finally(() => numeroOperacionesEnEjecucion--)
					} else {
						L.xw(row.txid, ['No hubo exito al guardar la entrada en MongoDB', row.uid], 'sqlitewatch');

						try {
							await iSQLite.incrementarNumeroDeIntentos(row.uid);
							L.xd(row.txid, ['Incrementado el contador de intentos de reenvío', row.uid], 'sqlitewatch');

							// Log de cuando una entrada agota el número de transmisiones

							if (row.retryCount === C.sqlite.maximoReintentos + 1)
								L.xw(row.txid, ['Se ha alcanzado el número máximo de retransmisiones para la entrada', row.uid], 'sqlitewatch');
						} catch (errorSQLite) {
							L.xe(row.txid, ['Error al incrementar el contador de intentos de reenvío para la entrada', row.uid], 'sqlitewatch')
						}

						numeroOperacionesEnEjecucion--;

					}
				}).catch((error) => {
					L.e(['Ocurrió un error no controlado al grabar la entrada de SQLite a MongoDB', row.uid, error], 'sqlitewatch');
					numeroOperacionesEnEjecucion--;
				})
		});

		hayOperacionesEnProceso = false;

	}, C.sqlite.intervalo)

	return idIntervalo;
}


