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

		L.i(['*** Conectado a la base de datos de emergencia SQLite3 en la ruta [' + config.sqlite.db_path + ']'], 'sqlite');
		db.exec('CREATE TABLE IF NOT EXISTS tx(uid CHARACTER(24) PRIMARY KEY, txid CHARACTER(24), data TEXT)');

});
}


var storeTx = function(data) {

	var uid = (new ObjectID()).toHexString();
	var key = data['$setOnInsert']._id.toHexString() ;

	db.run('INSERT INTO tx(uid, txid, data) VALUES(?, ?, ?)', [uid, key, JSON.stringify(data)], function(err) {
		if(err) {
			L.xf(key, ["*** FALLO AL GRABAR EN LA BASE DE DATOS DE RESPALDO. PELIGRO DE PERDIDA DE DATOS", err, data], 'sqlite');
			return;
		}
		L.xw(key, '* Actualización de la transacción almacenada en base de datos auxiliar con UID [' + uid + ']', 'sqlite');
	});

}

module.exports = {
	connect: connect,
	storeTx: storeTx
}

connect();
