'use strict';
//const BASE = global.BASE;
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externo
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;


const MONGODB_OPTIONS = {
	connectTimeoutMS: 5000,
	serverSelectionTimeoutMS: 5000,
	w: C.mongodb.writeconcern || 1,
	wtimeout: 1000,
	useUnifiedTopology: true,
	appname: global.instanceID,
	loggerLevel: 'warn'
};

const colecciones = {
	tx: null,
	discard: null,
	control: null
};

let clienteDb;

const conectar = () => {
	if (clienteDb) return;

	clienteDb = new MongoClient(C.getMongoUrl(), MONGODB_OPTIONS);
	clienteDb.connect()
		.then((cliente) => {
			clienteDb = cliente;
			let bdFedicom = clienteDb.db(C.mongodb.database);

			let nombreColeccionTx = C.mongodb.txCollection || 'tx';
			colecciones.tx = bdFedicom.collection(nombreColeccionTx);
			L.i(['*** Conexión a la colección [' + C.mongodb.database + '.' + nombreColeccionTx + '] para almacenamiento de transmisiones'], 'mongodb');

			let nombreColeccionDiscard = C.mongodb.discardCollection || 'discard';
			colecciones.discard = bdFedicom.collection(nombreColeccionDiscard);
			L.i(['*** Conexión a la colección [' + C.mongodb.database + '.' + nombreColeccionDiscard + '] para almacenamiento de transmisiones descartadas'], 'mongodb');

			let nombreColeccionControl = C.mongodb.controlCollection || 'control';
			colecciones.control = bdFedicom.collection(nombreColeccionControl);
			L.i(['*** Conexión a la colección [' + C.mongodb.database + '.' + nombreColeccionControl + '] para control'], 'mongodb');

		})
		.catch(error => {
			L.f(['*** Error en la conexión a de MongoDB ***', mongourl, error], 'mongodb')
			clienteDb = null;
		});
}

conectar();
setInterval(conectar, 10000);


module.exports = {
	ObjectID,
	cliente: () => clienteDb,
	db: (nombreDB) => clienteDb.db(nombreDB || C.mongodb.database),
	colTx: () => colecciones.tx,
	colDiscard: () => colecciones.discard,
	colControl: () => colecciones.control
};
