'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Interfaces
const MDB = require('./iMongoConexion');


const getReplicaSet = (callback) => {
	let db = MDB.db('admin');
	if (db) {
		db.command({ "replSetGetStatus": 1 }, callback)
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}

}

const getColeccion = (nombreColeccion, callback) => {
	let db = MDB.db();
	if (db) {
		db.command({ collStats: nombreColeccion }, callback);
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}


const getNombresColecciones = (callback) => {
	let db = MDB.db();
	if (db) {
		db.command({ listCollections: 1, nameOnly: true }, (err, data) => {
			if (err) {
				callback(err, null);
				return;
			}

			if (data && data.cursor && data.cursor.firstBatch) {
				let collections = [];
				data.cursor.firstBatch.forEach(element => {
					collections.push(element.name);
				});
				callback(false, collections);
				return;
			}
			callback('data.cursor.firstBatch no existe', null);
			return;
		});
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}

const getDatabase = (callback) => {
	let db = MDB.db();
	if (db) {
		db.command({ dbStats: 1 }, callback);
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}

const getOperaciones = (callback) => {
	let db = MDB.db('admin');
	if (db) {
		db.executeDbAdminCommand({ currentOp: true, "$all": true }, (err, operations) => {
			if (err) {
				callback(err, null);
				return;
			}

			callback(false, operations.inprog);
			return;
		});
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}


const getLogs = (tipoLog, callback) => {
	let db = MDB.db('admin');
	if (db) {
		db.executeDbAdminCommand({ getLog: tipoLog }, callback);
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}

module.exports = {
	getReplicaSet,
	getColeccion,
	getNombresColecciones,
	getDatabase,
	getOperaciones,
	getLogs
}