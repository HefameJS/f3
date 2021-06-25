'use strict';
const M = global.M;


module.exports.getReplicaSet = async function () {
	let db = M.getBD('admin');
	return await db.command({ "replSetGetStatus": 1 })
}

module.exports.getColeccion = async function (nombreColeccion) {
	let db = M.getBD();
	return await db.command({ collStats: nombreColeccion });
}


module.exports.getNombresColecciones = async function () {
	let db = M.getBD();
	let nombresColecciones = await db.command({ listCollections: 1, nameOnly: true })

	if (nombresColecciones?.cursor?.firstBatch) {
		return nombresColecciones.cursor.firstBatch.map(element => element.name);
	} else {
		throw new Error('data.cursor.firstBatch no existe')
	}
}

module.exports.getDatabase = async function () {
	let db = M.getBD();
	return await db.command({ dbStats: 1 });
}

module.exports.getOperaciones = async function () {
	let db = M.getBD('admin');
	let operaciones = await db.executeDbAdminCommand({ currentOp: true, "$all": true });
	return operaciones.inprog;
}

module.exports.getLogs = async function (tipoLog) {
	let db = M.getBD('admin');
	return await db.executeDbAdminCommand({ getLog: tipoLog });
}
