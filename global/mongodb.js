'use strict';
const C = global.C;
const L = global.L;
const MongoDb = require('mongodb');



module.exports = async function () {

	L.info('Conectando al clúster MongoDB');
	let cliente = new MongoDb.MongoClient(C.mongodb.getUrl(), C.mongodb.getConfigConexion());
	let baseDatos = null;
	let colecciones = {
		transmisiones: null,
		configuracion: null
	};

	let opcionesColeccion1 = { writeConcern: { w: 1, wtimeout: 1000 } }
	let opcionesColeccion2 = { writeConcern: { w: 0, wtimeout: 1000 } }

	try {
		cliente = await cliente.connect();
		baseDatos = cliente.db(C.mongodb.database);
		colecciones.transmisiones = baseDatos.collection('transmisiones', opcionesColeccion1);
		colecciones.descartes = baseDatos.collection('descartes', opcionesColeccion2);
		colecciones.configuracion = baseDatos.collection('configuracion', opcionesColeccion1);
		L.info('Conexión a MongoDB establecida')
	}
	catch (error) {
		L.err('Error en la conexión a de MongoDB:', error)
		L.err(`Reintentando la conexión en ${C.mongodb.intervaloReconexion} milisegundos`)
		setTimeout(() => conexion(), C.mongodb.intervaloReconexion)
	}


	global.M.ObjectID = MongoDb.ObjectID;
	global.M.toMongoLong = MongoDb.Long.fromNumber;

	global.M.conectado = cliente ? true : false;
	global.M.cliente = cliente;
	global.M.bd = baseDatos;
	global.M.db = baseDatos;
	global.M.getBD = (nombreDb) => { return (nombreDb ? cliente.db(nombreDb) : baseDatos) };
	global.M.col = {
		transmisiones: colecciones.transmisiones,
		configuracion: colecciones.configuracion
	}

}
