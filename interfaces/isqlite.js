'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;


const ObjectID = require('mongodb').ObjectID;
const sqlite3 = require('sqlite3').verbose();
var db;



/**
 * Almacena una sentencia mongoDB en la base de datos SQLite local
 * @param {*} sentenciaMDB
 */
const storeTx = function(sentenciaMDB) {

	var uid = (new ObjectID()).toHexString();
	var key = sentenciaMDB['$setOnInsert']._id.toHexString() ;

	db.run('INSERT INTO tx(uid, txid, data, retryCount) VALUES(?, ?, ?, ?)', [uid, key, JSON.stringify(sentenciaMDB), 0], function(err) {
		if(err) {
			L.xf(sentenciaMDB['$setOnInsert']._id, ["*** FALLO AL GRABAR EN LA BASE DE DATOS DE RESPALDO - PELIGRO DE PERDIDA DE DATOS", err, sentenciaMDB], 'sqlite');
			return;
		}
		L.xw(sentenciaMDB['$setOnInsert']._id, ['* Se almacenó el COMMIT fallido en la base de datos auxiliar', uid], 'sqlite');
	});

}


/**
 * Obtiene el número total de entradas en la base de datos SQLite.
 * Si se especifica maxRetries, solo se devuelven las entradas con un valor inferior al indicado
 * @param {*} maxRetries 
 * @param {function} cb (err, numeroEntradas)
 */
const countTx = function (maxRetries, callback) {

	if (!maxRetries) maxRetries = Infinity;

	db.all('SELECT count(*) as count FROM tx WHERE retryCount < ?', [maxRetries], function(err, rows) {
		if(err) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", err], 'sqlite');
			return callback(err, null);
		}

		if (rows && rows[0] && rows[0].count >= 0) {
			return callback(null, rows[0].count);
		}

		L.e(['Error en la respuesta', rows], 'sqlite');
		return callback('Error al contar las líneas', null);

	});
}

/**
 * Obtiene todas las entradas de la base de datos SQLite.
 * Si se especifica maxRetries, solo se devuelven las entradas con un valor inferior al indicado.
 * Se puede hacer una búsqueda paginada con los parámetros limit y offset
 * @param {*} maxRetries 
 * @param {*} limit 
 * @param {*} offset 
 * @param {*} callback 
 */
const retrieveAll = function (maxRetries, limit, offset, callback) {

	if (!maxRetries) maxRetries = Infinity;

	let sql = 'SELECT * FROM tx WHERE retryCount < ?'

	if (limit > 0) sql += ' LIMIT ' + parseInt(limit)
	if (offset > 0) sql += ' OFFSET ' + parseInt(offset)


	db.all(sql, [maxRetries], function(err, rows) {
		if(err) {
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
 * Elimina la entrada de la base de datos de respaldo
 * @param {*} uid 
 * @param {*} cb 
 */
const removeUid = function (uid, cb) {
	db.run('DELETE FROM tx WHERE uid = ?', [uid], function(err) {
		if(err) {
			L.f(["*** Fallo al borrar la entrada de la base de datos de respaldo", err], 'sqlite');
			return cb(err, 0);
		}
		return cb(null, this.changes);
	});
}

/**
 * Incrementa en 1 el número de retryCount de la entrada de la base de datos indicada.
 * @param {*} uid
 * @param {*} cb
 */
const incrementUidRetryCount = function (uid, cb) {
	db.run('UPDATE tx SET retryCount = retryCount + 1 WHERE uid = ?', [uid], function (err) {
		if (err) {
			L.f(["*** Fallo al incrementar el número de intentos para la entrada", err], 'sqlite');
				return cb(err, 0);

		}
		return cb(null, this.changes);
	});
}


module.exports = {
	storeTx,
	countTx,
	retrieveAll,
	removeUid,
	incrementUidRetryCount
}

const connect = () => {
	db = new sqlite3.Database(config.sqlite.db_path, (err) => {
		if (err) {
			L.f(['*** NO SE PUDO CONECTAR A SQLITE ***', config.sqlite.db_path, err], 'sqlite');
			return;
		}

		L.i(['*** Conectado a la base de datos de emergencia SQLite3', config.sqlite.db_path], 'sqlite');
		db.exec('CREATE TABLE IF NOT EXISTS tx(uid CHARACTER(24) PRIMARY KEY, txid CHARACTER(24), data TEXT, retryCount INTEGER)');

	});
}

connect();

