'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externo
const { EJSON } = require('bson');
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
	let txId = transaccion['$setOnInsert']._id;
	let txIdHexadecimal = txId.toHexString();


	// Para serializar correctamente objetos como ObjectIDs y Dates
	// https://docs.mongodb.com/v3.0/reference/mongodb-extended-json/
	// https://www.npmjs.com/package/bson
	let jsonExtendido = EJSON.stringify(transaccion, { relaxed: false });

	db.run('INSERT INTO tx(uid, txid, data, retryCount) VALUES(?, ?, ?, ?)', [uid, txIdHexadecimal, jsonExtendido, 0], (err) => {
		if (err) {
			L.xf(txId, ["*** FALLO AL GRABAR EN LA BASE DE DATOS DE RESPALDO - PELIGRO DE PERDIDA DE DATOS", err, transaccion], 'sqlite');
			return;
		}
		L.xw(txId, ['* Se almacenó el COMMIT fallido en la base de datos auxiliar', uid], 'sqlite');
	});

}

/**
 * Devuelve el número de entradas que hay en la base de datos y que están pendientes de ser enviadas.
 * Solo se cuentan aquellas que se han intentado salvar en MongoDB y han fallado menos de las veces indicadas en C.watchdog.sqlite.maxRetries (por defecto 10). 
 * @param {*} numeroFallosMaximo 
 * @param {*} callback 
 */
const numeroEntradasPendientes = (callback) => {

	db.all('SELECT count(*) as count FROM tx WHERE retryCount < ?', [C.watchdog.sqlite.maxRetries || 10], (errorSQLite, resultados) => {
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

	db.all('SELECT * FROM tx WHERE retryCount < ?', [numeroFallosMaximo], (errorSQLite, entradas) => {
		if (errorSQLite) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
			return callback(errorSQLite, null);
		}

		if (entradas && entradas.length) {
			// Como se guardan en SQLite los datos de las transacciones como un Extended JSON "stringificado",
			// los convertimos de vuelta a BSON
			let entradasSaneadas = entradas.map( entrada => {
				entrada.data = EJSON.parse(entrada.data, {relaxed: false});
				return entrada;
			});
			return callback(null, entradasSaneadas);
		}
		L.e(['Se devuelve lista de entradas vacía', entradas], 'sqlite');
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

/**
 * Genera un recuento del número de entradas que hay en la base de datos agrupadas por el numero de veces que han sido intentadas enviar a MongoDB
 * @param {*} callback 
 */
const recuentoRegistros = (callback) => {

	db.all('SELECT retryCount AS intentos, count(*) as cantidad FROM tx GROUP BY retryCount ORDER BY intentos', [], (errorSQLite, resultados) => {
		if (errorSQLite) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
			return callback(errorSQLite, null);
		}
		
		return callback(null, resultados);
	});
}


/**
 * Permite realizar una consulta de las entradas de la base de datos.
 * Admite como opciones un objeto con los siguientes campos para modificar los filtros/orden/paginacion:
 * - where:
 * 		Acepta un objeto con el trozo de sentencia SQL y los valores a asignar a los condicionales, ejemplo:
 * 		{
 * 			sql: 'WHERE retryCount >= ? AND txid = ?',
 * 			valores: [10, "5eb3bd86acfc103c8ca8b1ed"]
 * 		}
 * - orderby:
 * 		Acepta un string con la sentencia SQL. Por ejemplo
 * 			'ORDER BY retryCount DESC'
 * - limit:
 * 		Numerico - El límite máximo de registros a retornar. 
  * - offset:
 * 		Numerico - El número de registro a partir del cual retornar resultados.
 * 
 * Ejemplo completo
 * {
 * 		where: {
 *			sql: 'WHERE retryCount >= ? AND txid = ?',
 * 			valores: [10, "5eb3bd86acfc103c8ca8b1ed"]
 * 		},
 * 		orderby: 'ORDER BY retryCount DESC',
 * 		limit: 50,
 * 		offset: 150
 * }
 * @param {*} where 
 * @param {*} callback 
 */
const consultaRegistros = (opciones, callback) => {

	let sql = 'SELECT uid, txid, data as transaccion, retryCount as intentos FROM tx';
	let valores = []

	if (opciones.where) {
		sql += ' ' + opciones.where.sql;
		valores = opciones.where.valores;
	}
	if (opciones.orderby) 		sql += ' ' + opciones.orderby
	if (opciones.limit) 		sql += ' LIMIT ' + opciones.limit;
	if (opciones.offset) 		sql += ' OFFSET ' + opciones.offset;
	
	L.t(['Consulta SQLite', sql, valores], 'sqlite');


	db.all(sql, valores, (errorSQLite, entradas) => {
		if (errorSQLite) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
			return callback(errorSQLite, null);
		}

		if (entradas && entradas.length) {
			// Como se guardan en SQLite los datos de las transacciones como un Extended JSON "stringificado",
			// los convertimos de vuelta a BSON
			let entradasSaneadas = entradas.map(entrada => {
				entrada.transaccion = EJSON.parse(entrada.transaccion, { relaxed: false });
				return entrada;
			});
			return callback(null, entradasSaneadas);
		}
		L.e(['Se devuelve lista de entradas vacía', entradas], 'sqlite');
		return callback(null, []);

	});
}

module.exports = {
	grabarTransaccion,
	numeroEntradasPendientes,
	obtenerEntradas,
	eliminarEntrada,
	incrementarNumeroDeIntentos,
	recuentoRegistros,
	consultaRegistros
}


