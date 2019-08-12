'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;


const ObjectID = require('mongodb').ObjectID;
const sqlite3 = require('sqlite3').verbose();
var db;


var connect = function() {
	db = new sqlite3.Database(config.sqlite.db_path, (err) => {
		if (err) {
			L.f(['*** NO SE PUDO CONECTAR A SQLITE ***', config.sqlite.db_path, err], 'sqlite');
			return;
		}

		L.i(['*** Conectado a la base de datos de emergencia SQLite3', config.sqlite.db_path], 'sqlite');
		db.exec('CREATE TABLE IF NOT EXISTS tx(uid CHARACTER(24) PRIMARY KEY, txid CHARACTER(24), data TEXT)');

});
}


var storeTx = function(data) {

	var uid = (new ObjectID()).toHexString();
	var key = data['$setOnInsert']._id.toHexString() ;

	db.run('INSERT INTO tx(uid, txid, data) VALUES(?, ?, ?)', [uid, key, JSON.stringify(data)], function(err) {
		if(err) {
			L.xf(key, ["*** FALLO AL GRABAR EN LA BASE DE DATOS DE RESPALDO - PELIGRO DE PERDIDA DE DATOS", err, data], 'sqlite');
			return;
		}
		L.xw(key, ['* Actualización de la transacción almacenada en base de datos auxiliar', uid], 'sqlite');
	});

}


var countTx = function (cb) {
	db.all('SELECT count(*) as count FROM tx', function(err, rows) {
		if(err) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", err], 'sqlite');
			return cb(err, null);
		}

		if (rows && rows[0] && rows[0].count >= 0) {
			return cb(null, rows[0].count);
		}

		L.e(['Error en la respuesta', rows], 'sqlite');
		return cb('Error al contar las líneas', null);

	});
}


var retrieveAll = function (cb) {
	db.all('SELECT * FROM tx', function(err, rows) {
		if(err) {
			L.f(["*** FALLO AL LEER LA BASE DE DATOS DE RESPALDO", err], 'sqlite');
			return cb(err, null);
		}

		if (rows && rows.length) {
			return cb(null, rows);
		}
		L.e(['Se devuelve lista de entradas vacía', rows], 'sqlite');
		return cb(null, []);

	});
}

var removeUid = function (uid, cb) {
	db.run('DELETE FROM tx WHERE uid = ?', [uid], function(err) {
		if(err) {
			L.f(["*** Fallo al borrar la entrada de la base de datos de respaldo", err], 'sqlite');
			return cb(err, 0);
		}
		return cb(null, this.changes);

	});
}

module.exports = {
	connect: connect,
	storeTx: storeTx,
	countTx: countTx,
	retrieveAll: retrieveAll,
	removeUid: removeUid
}

connect();
