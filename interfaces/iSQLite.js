'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externo
const { EJSON } = require('bson');
const ObjectID = require('mongodb').ObjectID;
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(C.sqlite.fichero, (err) => {
	if (err) {
		L.f(['No se pudo conectar a SQLite', C.sqlite.fichero, err], 'sqlite');
		return;
	}

	L.i(['Conectado a la base de datos SQLite3', C.sqlite.fichero], 'sqlite');
	db.exec('CREATE TABLE IF NOT EXISTS tx(uid CHARACTER(24) PRIMARY KEY, txid CHARACTER(24), data TEXT, retryCount INTEGER)');
});

/**
 * Graba en la base de datos SQLite la transacción MongoDB pasada.
 * @param {*} transaccion 
 */
const grabarTransaccion = function (transaccion) {

	return new Promise((resolve, reject) => {
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
				resolve(false);
			} else {
				L.xw(txId, ['* Se almacenó el COMMIT fallido en la base de datos auxiliar', uid], 'sqlite');
				resolve(true);
			}
		});
	});



}

/**
 * Devuelve el número de entradas que hay en la base de datos y que están pendientes de ser enviadas.
 * Solo se cuentan aquellas que se han intentado salvar en MongoDB y han fallado menos de las veces indicadas en C.sqlite.maximoReintentos (por defecto 10).
 * @param {*} numeroFallosMaximo 
 * @param {*} callback 
 */
const numeroEntradasPendientes = () => {

	return new Promise((resolve, reject) => {
		db.all('SELECT count(*) as count FROM tx WHERE retryCount < ?', [C.sqlite.maximoReintentos], (errorSQLite, resultados) => {
			if (errorSQLite) {
				L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
				reject(errorSQLite);
			}
			else if (resultados && resultados[0] && resultados[0].count >= 0) {
				resolve(resultados[0].count);
			}
			else {
				L.e(['Error en la respuesta', resultados], 'sqlite');
				reject(new Error('Error al contar las líneas'), null);
			}

		});
	});
}


/**
 * Devuelve los datos de todas las entradas que haya en la base de datos SQLite.
 * Si se indica un número de fallos positivo, se retornan solo aquellas que se han intentado 
 * salvar en MongoDB y han fallado menos de las veces indicadas. Este parámetro es útil 
 * para obtener solo aquellas que son candidatas para pasarlas a MongoDB.
 * @param {*} numeroFallosMaximo
 */
const obtenerEntradas = (numeroFallosMaximo, limite) => {

	return new Promise((resolve, reject) => {

		let sql = 'SELECT * FROM tx';
		let parametrosSql = [];
		numeroFallosMaximo = parseInt(numeroFallosMaximo);
		limite = parseInt(limite);

		if (numeroFallosMaximo > 0) {
			sql += ' WHERE retryCount < ?';
			parametrosSql.push(numeroFallosMaximo);
		}

		sql += ' ORDER BY uid';

		if (limite > 0) {
			sql += ' LIMIT ' + limite;
		}

		

		db.all(sql, parametrosSql, (errorSQLite, entradas) => {
			if (errorSQLite) {
				L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
				reject(errorSQLite);
			}
			else if (entradas && entradas.length) {
				// Como se guardan en SQLite los datos de las transacciones como un Extended JSON "stringificado",
				// los convertimos de vuelta a BSON
				let entradasSaneadas = entradas.map(entrada => {
					entrada.data = EJSON.parse(entrada.data, { relaxed: false });
					return entrada;
				});
				resolve(entradasSaneadas);
			} else {
				L.d(['Se devuelve lista de entradas vacía', entradas], 'sqlite');
				resolve([]);
			}

		});
	})

}

/**
 * Elimina de la base de datos SQLite la entrada con el UID indicado.
 * @param {*} uid 
 */
const eliminarEntrada = (uid) => {

	return new Promise((resolve, reject) => {

		db.run('DELETE FROM tx WHERE uid = ?', [uid], (errorSQLite) => {
			if (errorSQLite) {
				L.f(["*** Fallo al borrar la entrada de la base de datos de respaldo", errorSQLite], 'sqlite');
				reject(errorSQLite);
			} else {
				resolve(this.changes)
			}
		});

	});


}

/**
 * Actualiza en la base de datos la entrada con el UID indicado para aumentar su campo 'retryCount' en uno.
 * Cuando este valor alcanza el umbral configurado en 'C.sqlite.maximoReintentos', se deja de intentar pasar
 * la entrada de SQLite a MongoDB.
 * @param {*} uid 
 */
const incrementarNumeroDeIntentos = (uid) => {

	return new Promise((resolve, reject) => {
		db.run('UPDATE tx SET retryCount = retryCount + 1 WHERE uid = ?', [uid], (errorSQLite) => {
			if (errorSQLite) {
				L.f(["*** Fallo al incrementar el número de intentos para la entrada", errorSQLite], 'sqlite');
				reject(errorSQLite);
			} else {
				resolve(this.changes);
			}
		});
	})
}

/**
 * Genera un recuento del número de entradas que hay en la base de datos agrupadas por 
 * el numero de veces que han sido intentadas enviar a MongoDB
 */
const recuentoRegistros = () => {

	return new Promise((resolve, reject) => {
		let umbralIntentosMaximos = C.sqlite.maximoReintentos;

		db.all('SELECT CASE WHEN retryCount BETWEEN 0 AND ? THEN "pendientes" ELSE "expiradas" END AS estado, count(*) AS cantidad FROM tx GROUP BY estado;', [umbralIntentosMaximos], (errorSQLite, resultados) => {
			if (errorSQLite) reject(errorSQLite)
			else resolve(resultados)
		});
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
 * - orden:
 * 		Acepta un string con la sentencia SQL que irá detrás de ORDER BY. Por ejemplo
 * 			'retryCount DESC'
 * - limit:
 * 		Numerico - El límite máximo de registros a retornar. 
  * - offset:
 * 		Numerico - El número de registro a partir del cual retornar resultados.
 * 
 * Ejemplo completo
 * {
 * 		filtro: {
 *			sql: 'WHERE retryCount >= ? AND txid = ?',
 * 			valores: [10, "5eb3bd86acfc103c8ca8b1ed"]
 * 		},
 * 		orden: 'retryCount DESC',
 * 		limite: 50,
 * 		skip: 150
 * }
 * @param {*} opciones 
 * @param {*} callback 
 */
const consultaRegistros = (opciones, callback) => {

	return new Promise((resolve, reject) => {

		let sql = 'SELECT uid, txid, data as transaccion, retryCount as intentos FROM tx';
		let sqlContador = 'SELECT count(*) as count FROM tx';
		let valores = []

		let limite = Math.min(opciones.limite || 50, 50);
		let skip = Math.max(opciones.skip || 0, 0);

		if (opciones.filtro) {
			sql += ' ' + opciones.filtro.sql;
			sqlContador += ' ' + opciones.filtro.sql;
			valores = opciones.filtro.valores;
		}
		if (opciones.orden) sql += ' ORDER BY ' + opciones.orden
		sql += ' LIMIT ' + limite;
		sql += ' OFFSET ' + skip;

		L.t(['Consulta SQLite', sql, valores], 'sqlite');


		db.get(sqlContador, valores, (errorContadorSQLite, filaNumeroEntradas) => {
			if (errorContadorSQLite) {
				L.f(['Fallo al contar el número de entradas en la base de datos', errorContadorSQLite], 'sqlite');
				reject(errorSQLite);
				return;
			}
			let numeroEntradas = filaNumeroEntradas.count;

			db.all(sql, valores, (errorSQLite, entradas) => {
				if (errorSQLite) {
					L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", errorSQLite], 'sqlite');
					reject(errorSQLite);
					return;
				}

				if (entradas) {
					// Como se guardan en SQLite los datos de las transacciones como un Extended JSON "stringificado",
					// los convertimos de vuelta a BSON
					let entradasSaneadas = entradas.map(entrada => {
						entrada.transaccion = EJSON.parse(entrada.transaccion, { relaxed: false });
						return entrada;
					});
					resolve({
						resultados: entradasSaneadas,
						limite: limite,
						skip: skip,
						total: numeroEntradas
					});
					return;
				}

			});
		});
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


