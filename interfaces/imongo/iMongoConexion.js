'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externo
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;

const conexion = async function () {
	let C = global.config;
	let L = global.logger;

	L.i(['Conectando al clúster MongoDB'], 'mongodb')

	let cliente = new MongoClient(C.mongodb.getUrl(), C.mongodb.getConfigConexion());
	let baseDatos = null;
	let colecciones = {
		tx: null,
		discard: null,
		control: null,
		configuracion: null
	};

	try {
		cliente = await cliente.connect();
		baseDatos = cliente.db(C.mongodb.database);
		colecciones.tx = baseDatos.collection('tx');
		colecciones.discard = baseDatos.collection('discard');
		colecciones.control = baseDatos.collection('control');
		colecciones.configuracion = baseDatos.collection('configuracion');
		L.i(['Conexión a MongoDB establecida'], 'mongodb')

	}
	catch (error) {
		L.f(['Error en la conexión a de MongoDB', C.mongodb.getUrl(), error], 'mongodb')
		L.f(['Reintentando la conexión en milisegundos', C.mongodb.intervaloReconexion], 'mongodb')
		setTimeout(() => conexion(), C.mongodb.intervaloReconexion)
	}

	global.mongodb = {
		ObjectID,
		conectado: cliente ? true : false,
		cliente,
		bd: baseDatos,
		col: colecciones
	}

	return global.mongodb;
}

module.exports = conexion;
