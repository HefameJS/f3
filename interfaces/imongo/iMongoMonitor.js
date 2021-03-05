'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
const M = global.mongodb;


const getReplicaSet = async function () {
	let db = M.getBD('admin');
	return await db.command({ "replSetGetStatus": 1 })
}

const getColeccion = async function (nombreColeccion) {
	let db = M.getBD();
	return await db.command({ collStats: nombreColeccion });
}


const getNombresColecciones = async function () {
	let db = M.getBD();
	let nombresColecciones = await db.command({ listCollections: 1, nameOnly: true })

	if (nombresColecciones?.cursor?.firstBatch) {
		return nombresColecciones.cursor.firstBatch.map(element => element.name);
	} else {
		throw new Error('data.cursor.firstBatch no existe')
	}
}

const getDatabase = async function () {
	let db = M.getBD();
	return await db.command({ dbStats: 1 });
}

const getOperaciones = async function () {
	let db = M.getBD('admin');
	let operaciones = await db.executeDbAdminCommand({ currentOp: true, "$all": true });
	return operaciones.inprog;
}

const getLogs = async function (tipoLog) {
	let db = M.getBD('admin');
	return await db.executeDbAdminCommand({ getLog: tipoLog });
}

module.exports = {
	getReplicaSet,
	getColeccion,
	getNombresColecciones,
	getDatabase,
	getOperaciones,
	getLogs
}