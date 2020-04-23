'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externo
const ObjectID = require('mongodb').ObjectID;
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(C.sqlite.db_path, (err) => {
	if (err) {
		L.f(['*** NO SE PUDO CONECTAR A SQLITE ***', C.sqlite.db_path, err], 'sqlite');
		return;
	}

	L.i(['Conectado a la base de datos de emergencia SQLite3', C.sqlite.db_path], 'sqlite');
	db.exec('CREATE TABLE IF NOT EXISTS tx(uid CHARACTER(24) PRIMARY KEY, txid CHARACTER(24), data TEXT, retryCount INTEGER)');
});

/**
 * Graba en la base de datos SQLite la transacción MongoDB pasada.
 * @param {*} transaccion 
 */
const grabarTransaccion = (transaccion) => {

	let uid = (new ObjectID()).toHexString();
	let txId = transaccion['$setOnInsert']._id.toHexString();
	let txIdHexadecimal = txId.toHexString();

	// TODO: https://docs.mongodb.com/v3.0/reference/mongodb-extended-json/ Para serializar correctamente objetos como ObjectIDs y Dates
	// en vez de usar JSON.stringify()
	db.run('INSERT INTO tx(uid, txid, data, retryCount) VALUES(?, ?, ?, ?)', [uid, txIdHexadecimal, JSON.stringify(transaccion), 0], (err) => {
		if (err) {
			L.xf(txId, ["*** FALLO AL GRABAR EN LA BASE DE DATOS DE RESPALDO - PELIGRO DE PERDIDA DE DATOS", err, transaccion], 'sqlite');
			return;
		}
		L.xw(txId, ['* Se almacenó el COMMIT fallido en la base de datos auxiliar', uid], 'sqlite');
	});

}

/**
 * Devuelve el número de entradas que hay en la base de datos.
 * Si se indica un número de fallos positivo, se cuentan solo aquellas que se han intentado salvar en MongoDB y han fallado
 * menos de las veces indicadas. Este parámetro es útil para ver cuales NO han fallado y son candidatas a grabar.
 * @param {*} numeroFallosMaximo 
 * @param {*} callback 
 */
const contarEntradas = (numeroFallosMaximo, callback) => {

	if (!numeroFallosMaximo) numeroFallosMaximo = Infinity;

	db.all('SELECT count(*) as count FROM tx WHERE retryCount < ?', [numeroFallosMaximo], (errorSQLite, resultados) => {
		if (errorSQLite) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
			return callback(errorSQLite, null);
		}

		if (resultados && resultados[0] && resultados[0].count >= 0) {
			return callback(null, resultados[0].count);
		}

		L.e(['Error en la respuesta', resultados], 'sqlite');
		return callback('Error al contar las líneas', null);

	});
}


/**
 * Devuelve los datos de todas las entradas que haya en la base de datos SQLite.
 * Si se indica un número de fallos positivo, se retornan solo aquellas que se han intentado salvar en MongoDB y han fallado
 * menos de las veces indicadas. Este parámetro es útil para obtener solo aquellas que son candidatas para pasarlas a MongoDB.
 * @param {*} numeroFallosMaximo
 * @param {*} callback
 */
const obtenerEntradas = (numeroFallosMaximo, callback) => {

	if (!numeroFallosMaximo) numeroFallosMaximo = Infinity;

	db.all('SELECT * FROM tx WHERE retryCount < ?', [numeroFallosMaximo], (err, rows) => {
		if (err) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", err], 'sqlite');
			return callback(err, null);
		}

		if (rows && rows.length) {
			return callback(null, rows);
		}
		L.e(['Se devuelve lista de entradas vacía', rows], 'sqlite');
		return callback(null, []);

	});
}

/**
 * Elimina de la base de datos SQLite la entrada con el UID indicado.
 * @param {*} uid 
 * @param {*} callback 
 */
const eliminarEntrada = (uid, callback) => {
	db.run('DELETE FROM tx WHERE uid = ?', [uid], (errorSQLite) => {
		if (errorSQLite) {
			L.f(["*** Fallo al borrar la entrada de la base de datos de respaldo", errorSQLite], 'sqlite');
			return callback(errorSQLite, 0);
		}
		return callback(null, this.changes);
	});
}
/**
 * Actualiza en la base de datos la entrada con el UID indicado para aumentar su campo 'retryCount' en uno.
 * Cuando este valor alcanza el umbral configurado en 'C.watchdog.sqlite.maxRetries', se deja de intentar pasar
 * la entrada de SQLite a MongoDB.
 * @param {*} uid 
 * @param {*} callback 
 */
const incrementarNumeroDeIntentos = (uid, callback) => {
	db.run('UPDATE tx SET retryCount = retryCount + 1 WHERE uid = ?', [uid], (errorSQLite) => {
		if (errorSQLite) {
			L.f(["*** Fallo al incrementar el número de intentos para la entrada", errorSQLite], 'sqlite');
			return callback(errorSQLite, 0);

		}
		return callback(null, this.changes);
	});
}

module.exports = {
	grabarTransaccion,
	contarEntradas,
	obtenerEntradas,
	eliminarEntrada,
	incrementarNumeroDeIntentos
}


