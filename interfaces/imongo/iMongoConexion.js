'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externo
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;

global.mongodb = {
	ObjectID: null,
	conectado: false,
	cliente: null,
	bd: null,
	getBD: (nombreDb) => { return null },
	col: {
		tx: null,
		descartes: null,
		control: null,
		configuracion: null
	}
}


const conexion = async function () {
	let C = global.config;
	let L = global.logger;

	L.i(['Conectando al clúster MongoDB'], 'mongodb')

	let cliente = new MongoClient(C.mongodb.getUrl(), C.mongodb.getConfigConexion());
	let baseDatos = null;
	let colecciones = {
		tx: null,
		descartes: null,
		control: null,
		configuracion: null
	};

	let opcionesColeccion1 = { writeConcern: { w: 1, wtimeout: 1000 } }
	let opcionesColeccion2 = { writeConcern: { w: 0, wtimeout: 1000 } }

	try {
		cliente = await cliente.connect();
		baseDatos = cliente.db(C.mongodb.database);
		colecciones.tx = baseDatos.collection('tx', opcionesColeccion1);
		colecciones.descartes = baseDatos.collection('descartes', opcionesColeccion2);
		// colecciones.control = baseDatos.collection('control', opcionesColeccion1);
		colecciones.configuracion = baseDatos.collection('configuracion', opcionesColeccion1);
		L.i(['Conexión a MongoDB establecida'], 'mongodb')
	}
	catch (error) {
		L.f(['Error en la conexión a de MongoDB', C.mongodb.getUrl(), error], 'mongodb')
		L.f(['Reintentando la conexión en milisegundos', C.mongodb.intervaloReconexion], 'mongodb')
		setTimeout(() => conexion(), C.mongodb.intervaloReconexion)
	}

	global.mongodb.ObjectID = ObjectID;
	global.mongodb.conectado = cliente ? true : false;
	global.mongodb.cliente = cliente;
	global.mongodb.bd = baseDatos
	global.mongodb.db = baseDatos
	global.mongodb.getBD = (nombreDb) => { return (nombreDb ? cliente.db(nombreDb) : baseDatos) }
	global.mongodb.col.tx = colecciones.tx;
	global.mongodb.col.descartes = colecciones.descartes;
	// global.mongodb.col.control = colecciones.control;
	global.mongodb.col.configuracion = colecciones.configuracion;
	return global.mongodb;
}

module.exports = conexion;
