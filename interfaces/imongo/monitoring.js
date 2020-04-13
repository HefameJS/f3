'use strict';
const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Interfaces
const iMongo = require(BASE + 'interfaces/imongo');


const getReplicaSet = (cb) => {
	iMongo.cliente().db('admin').command({ "replSetGetStatus": 1 }, cb)
}

const getColeccion = (collectionName, cb) => {
	iMongo.database().command({ collStats: collectionName }, cb);
}


const getNombresColecciones = (cb) => {
	iMongo.database().command({ listCollections: 1, nameOnly: true }, (err, data) => {
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

const getDatabase = (cb) => {
	iMongo.database().command({ dbStats: 1 }, cb);
}

const getOperaciones = (cb) => {
	iMongo.cliente().db('admin').executeDbAdminCommand({ currentOp: true, "$all": true }, (err, operations) => {
		if (err) {
			return cb(err, null);
		}

		return cb(false, operations.inprog);

	});
}


const getLogs = (logType, cb) => {
	iMongo.database().executeDbAdminCommand({ getLog: logType }, cb);
}

module.exports = {
	getReplicaSet,
	getColeccion,
	getNombresColecciones,
	getDatabase,
	getOperaciones,
	getLogs
}