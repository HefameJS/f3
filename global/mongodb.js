'use strict';
const C = global.C;
const L = global.L;
const MongoDb = require('mongodb');


class ColeccionDummy {

	esDummy = true;

	async updateOne() {
		throw new MongoDb.MongoError('No conectado a MongoDb (updateOne)')
	}

	async findOne() {
		throw new MongoDb.MongoError('No conectado a MongoDb (findOne)')
	}

}

const conexion = async function () {

	L.info('Conectando al clúster MongoDB');
	let cliente = new MongoDb.MongoClient(C.mongodb.getUrl(), C.mongodb.getConfigConexion());
	let baseDatos = null;
	let colecciones = {
		transmisiones: new ColeccionDummy(),
		configuracion: new ColeccionDummy(),
		descartes: new ColeccionDummy(),
		instancias: new ColeccionDummy(),
		maestros: new ColeccionDummy(),
		cacheUsuarios: new ColeccionDummy()
	};

	let opcionesColeccion1 = { writeConcern: { w: 1, wtimeout: 1000 } }
	let opcionesColeccion2 = { writeConcern: { w: 0, wtimeout: 1000 } }

	try {
		cliente = await cliente.connect();
		baseDatos = cliente.db(C.mongodb.database);

		colecciones.transmisiones = baseDatos.collection('transmisiones', opcionesColeccion1);
		colecciones.configuracion = baseDatos.collection('configuracion', opcionesColeccion1);
		colecciones.instancias = baseDatos.collection('instancias', opcionesColeccion1);
		colecciones.maestros = baseDatos.collection('maestros', opcionesColeccion1);
		colecciones.logs = baseDatos.collection('logs', opcionesColeccion2);
		colecciones.descartes = baseDatos.collection('descartes', opcionesColeccion2);
		colecciones.cacheUsuarios = baseDatos.collection('cacheUsuarios', opcionesColeccion2);

		L.info('Conexión a MongoDB establecida')
	}
	catch (error) {
		L.err('Error en la conexión a de MongoDB:', error)
		L.err(`Se reintentará la conexión en ${C.mongodb.intervaloReconexion} milisegundos`)
		setTimeout(() => conexion(), C.mongodb.intervaloReconexion)
	}
	

	global.M.ObjectID = MongoDb.ObjectId;
	global.M.toMongoLong = MongoDb.Long.fromNumber;


	global.M.cliente = cliente;
	global.M.bd = baseDatos;
	global.M.db = baseDatos;
	global.M.getBD = (nombreDb) => { return (nombreDb ? cliente.db(nombreDb) : baseDatos) };
	global.M.col = {
		transmisiones: colecciones.transmisiones,
		configuracion: colecciones.configuracion,
		instancias: colecciones.instancias,
		maestros: colecciones.maestros,
		logs: colecciones.logs,
		descartes: colecciones.descartes,
		cacheUsuarios: colecciones.cacheUsuarios
	}

	global.M.conectado = () => {
		for (let coleccion in global.M.col) {
			if (global.M.col[coleccion].esDummy) return false;
		}
		return true;
	}

}

module.exports = conexion;