'use strict';
//const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
const K = global.constants;


// Interfaces
const MDB = require('./iMongoConexion');
const ObjectID = require('mongodb').ObjectID;


/**
 * 
 * @param {*} consulta 
 * @param {*} callback 
 */
const consulta = (txId, consulta, callback) => {

	let filter = consulta.filter || {};
	let projection = consulta.projection || null;
	let sort = consulta.sort || null;
	let skip = consulta.skip || 0;
	let limit = consulta.limit || 100;
	limit = Math.min(limit, 100);

	// Si el filtro indica el parámetro '_id', lo transformamos a ObjectID antes de la consulta
	try {
		if (filter._id) {
			if (filter._id.$in) filter._id.$in = filter._id.$in.map(id => new ObjectID(id))
			else if (filter._id.$nin) filter._id.$nin = filter._id.$nin.map(id => new ObjectID(id))
			else filter._id = new ObjectID(filter._id);
		}
	} catch (e) { L.xe(txId, ['Error al convertir IDs a ObjectID', e]) }

	// Si el filtro indica el parámetro 'crc', lo transformamos a ObjectID antes de la consulta
	try {
		if (filter.crc) {
			if (filter.crc.$in) filter.crc.$in = filter.crc.$in.map(id => new ObjectID(id))
			else if (filter.crc.$nin) filter.crc.$nin = filter.crc.$nin.map(id => new ObjectID(id))
			else filter.crc = new ObjectID(filter.crc);
		}
	} catch (e) { L.xe(txId, ['Error al convertir CRC a ObjectID', e]) }

	// Si filtro indica fechas, las convertimos a Date
	try {
		if (filter.createdAt) {
			if (filter.createdAt.$gte) filter.createdAt.$gte = new Date(filter.createdAt.$gte)
			if (filter.createdAt.$lte) filter.createdAt.$lte = new Date(filter.createdAt.$lte)
		}
	} catch (e) { L.xe(txId, ['Error al convertir fechas a Date', e]) }

	// Por el momento, no se admiten '$or'
	if (filter.$or && filter.$or.length === 0) delete filter.$or;

	if (MDB.colTx()) {
		let cursor = MDB.colTx().find(filter);
		if (projection) cursor.project(projection);
		if (sort) cursor.sort(sort);
		if (skip) cursor.skip(skip);
		if (limit) cursor.limit(limit);

		cursor.count(false, (errorCount, count) => {
			if (errorCount) return callback(errorCount, null);

			cursor.toArray((errorToArray, result) => {
				if (errorToArray) return callback(errorToArray, null);

				return callback(null, {
					data: result,
					size: result.length,
					limit: limit,
					skip: skip,
					total: count
				});

			});
		});

	} else {
		callback({ error: "No conectado a MongoDB" }, null);
	}


}

/**
 * Busca la transmisión con el ID indicado
 * @param {*} txId 
 * @param {*} id 
 * @param {*} callback 
 */
const porId = (txId, id, callback) => {
	try {
		id = new ObjectID(id);
	} catch (excepcionObjectID) {
		L.xe(txId, ['El ID de la transmisión no es un ObjectID válido', id, excepcionObjectID]);
		callback(excepcionObjectID, null);
		return;
	}

	_consultaUnaTransmision(txId, { _id: id }, callback);
};

/**
 * Busca la transmisión con el CRC indicado.
 * Si la intención es saber si un CRC está duplicado, es mejor utilizar la funcion 'esDuplicado()'
 * @param {*} txId 
 * @param {*} crc 
 * @param {*} callback 
 */
const porCRC = (txId, crc, callback) => {
	try {
		crc = new ObjectID(crc);
	} catch (excepcionObjectID) {
		L.xe(txId, ['El CRC de la transmisión no es un ObjectID válido', crc, excepcionObjectID]);
		callback(excepcionObjectID, null);
		return;
	}

	_consultaUnaTransmision(txId, { crc: crc }, callback);
};

/**
 * Busca la transmisión con el CRC dado y llama al callback con el ID de la transmisión original 
 * si la encuentra o false de no encontrarla.
 * @param {*} txId
 * @param {*} crc 
 * @param {*} callback 
 */
const duplicadoDeCRC = (txId, crc, callback) => {

	try {
		crc = new ObjectID(crc);
	} catch (excepcionObjectID) {
		L.xe(txId, ['El CRC de la transmisión no es un ObjectID válido', crc, excepcionObjectID]);
		callback(excepcionObjectID, null);
		return;
	}

	if (MDB.colTx()) {
		MDB.colTx().findOne({ crc: crc }, { _id: 1 }, (errorMongo, resultado) => {
			if (errorMongo) {
				callback(errorMongo, null)
				return;
			}
			if (resultado) {
				callback(null, resultado._id);
				return;
			}
			callback(null, false);
			return;
		});
	} else {
		callback({ error: "No conectado a MongoDB" }, null);
	}
};

const porNumeroPedido = (txId, numeroPedido, callback) => {
	let query = {
		type: K.TX_TYPES.PEDIDO,
		numerosPedido: numeroPedido
	};

	_consultaUnaTransmision(txId, query, callback);
};

const porNumeroDevolucion = (txId, numeroDevolucion, callback) => {
	let query = {
		type: K.TX_TYPES.DEVOLUCION,
		numerosDevolucion: numeroDevolucion
	};

	_consultaUnaTransmision(txId, query, callback);
};

const porNumeroLogistica = (txId, numeroLogistica, callback) => {
	let query = {
		type: K.TX_TYPES.LOGISTICA,
		numeroLogistica: numeroLogistica
	};

	_consultaUnaTransmision(txId, query, callback);
};

const porCRCDeConfirmacion = (crc, callback) => {
	let filtro = {
		type: K.TX_TYPES.CONFIRMACION_PEDIDO,
		"clientRequest.body.crc": crc.substr(0, 8).toUpperCase()
	};

	// No podemos llamar a _consultaUnaTransmision = (txId, filtro, callback) 
	// porque no tenemos txId
	if (MDB.colTx()) {
		L.d(['Buscando transmisión', filtro], 'mongodb');
		MDB.colTx().findOne(filtro, callback);
	} else {
		L.e(['Error al localizar la transmisión'], 'mongodb');
		callback({ error: "No conectado a MongoDB" }, null);
	}
};

/**
 * Obtiene las transmisiones que son candidatas para ser retransmitidas por el watchdog
 * @param {*} limite Se retornarán como máximo este número de candidatas. Por defecto 10.
 * @param {*} antiguedadMinima Solo retornará como candidatas aquellas candidatas que tengan más de este número de segundos.
 * @param {*} callback 
 */
const candidatasParaRetransmitir = (limite, antiguedadMinima, callback) => {
	if (MDB.colTx()) {

		let consulta = {
			type: K.TX_TYPES.PEDIDO,		// Solo los pedidos son candidatos a retransmisión automática
			'$or': [
				{							// Que o bien estén en estado NO SAP ...
					status: K.TX_STATUS.NO_SAP
				},
				{							// .. o que esten en un estado intermedio durante al menos 'antiguedadMinima' segundos.
					status: { '$in': [K.TX_STATUS.RECEPCIONADO, K.TX_STATUS.ESPERANDO_INCIDENCIAS, K.TX_STATUS.INCIDENCIAS_RECIBIDAS, K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO] },
					modifiedAt: { $lt: new Date(Date.fedicomTimestamp() - (1000 * antiguedadMinima)) }
				}
			]
		};

		limite = limite || 10;

		L.t(['Consultando MDB por candidatos para retransmitir'], 'mongodb');
		MDB.colTx().find(consulta).limit(limite).toArray(callback);
	} else {
		L.e(['Error al buscar candidatos a retransmitir. No está conectado a mongodb'], 'mongodb');
		callback({ error: "No conectado a MongoDB" }, null);
	}
}



module.exports = {
	consulta,

	porId,
	porCRC,

	porNumeroPedido,
	porNumeroDevolucion,
	porNumeroLogistica,

	duplicadoDeCRC,

	porCRCDeConfirmacion,
	candidatasParaRetransmitir
}

const _consultaUnaTransmision = (txId, filtro, callback) => {
	if (MDB.colTx()) {
		L.xd(txId, ['Buscando transmisión', filtro], 'mongodb');
		MDB.colTx().findOne(filtro, callback);
	} else {
		L.xe(txId, ['Error al localizar la transmisión'], 'mongodb');
		callback({ error: "No conectado a MongoDB" }, null);
	}
}