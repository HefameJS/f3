'use strict';
//const BASE = global.BASE;
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

const getColeccion = (collectionName, callback) => {
	let db = MDB.db();
	if (db) {
		db.command({ collStats: collectionName }, callback);
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}


const getNombresColecciones = (cb) => {
	let db = MDB.db();
	if (db) {
		db.command({ listCollections: 1, nameOnly: true }, (err, data) => {
			if (err) {
				return cb(err, null);
			}

			if (data && data.cursor && data.cursor.firstBatch) {
				var collections = [];
				data.cursor.firstBatch.forEach(element => {
					collections.push(element.name);
				});
				return cb(false, collections);
			}
			return cb('data.cursor.firstBatch no existe', null);
		});
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}

const getDatabase = (cb) => {
	let db = MDB.db();
	if (db) {
		db.command({ dbStats: 1 }, cb);
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}

const getOperaciones = (cb) => {
	let db = MDB.db('admin');
	if (db) {
		db.executeDbAdminCommand({ currentOp: true, "$all": true }, (err, operations) => {
			if (err) {
				return cb(err, null);
			}

			return cb(false, operations.inprog);
		});
	}
	else {
		callback({ error: 'No conectado a MongoDB' }, null)
	}
}


const getLogs = (logType, cb) => {
	let db = MDB.db('admin');
	if (db) {
		db.executeDbAdminCommand({ getLog: logType }, cb);
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