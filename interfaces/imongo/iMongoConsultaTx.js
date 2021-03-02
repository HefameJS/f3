'use strict';
//const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Externas
const { EJSON } = require('bson');



const consulta = (txId, consulta, callback) => {

	L.xi(txId, consulta);

	let filtro = consulta.filtro || {};
	let proyeccion = consulta.proyeccion || null;
	let orden = consulta.orden || null;
	let skip = consulta.skip || 0;
	let limite = Math.min(consulta.limite || 50, 50);

	let filtroMongo = {}
	try {
		filtroMongo = EJSON.deserialize(filtro, { relaxed: false });
	} catch (errorDeserializadoEJSON) {
		L.e(['Error en la deserialización de la consulta EJSON', errorDeserializadoEJSON])
		callback(new Error('La consulta no es válida'), null);
		return;
	}


	// No se admiten '$or' vacíos, mongo peta
	if (filtroMongo.$or && filtroMongo.$or.length === 0) {
		delete filtroMongo.$or;
	}


	if (MDB.colTx()) {
		let cursor = MDB.colTx().find(filtroMongo);
		if (proyeccion) cursor.project(proyeccion);
		if (orden) cursor.sort(orden);
		if (skip) cursor.skip(skip);
		if (limite) cursor.limit(limite);

		cursor.count(false, (errorMongoCount, count) => {
			if (errorMongoCount) return callback(errorMongoCount, null);

			cursor.toArray((errorMongoToArray, resultados) => {
				if (errorMongoToArray) return callback(errorMongoToArray, null);

				return callback(null, {
					resultados: resultados,
					limite: limite,
					skip: skip,
					total: count
				});

			});
		});

	} else {
		callback(new Error('No conectado a MongoDB'), null);
	}
}


const agregacion = (txId, pipeline, callback) => {

	L.xi(txId, 'Realizando agregación');
	L.xd(txId, ['Consulta de agregación', pipeline]);

	try {
		pipeline = EJSON.deserialize(pipeline, { relaxed: false });
	} catch (errorDeserializadoEJSON) {
		L.e(['Error en la deserialización de la consulta EJSON', errorDeserializadoEJSON])
		callback(new Error('La consulta de agregación no es válida'), null);
		return;
	}


	if (MDB.colTx()) {
		MDB.colTx().aggregate(pipeline).toArray(callback);
	} else {
		callback(new Error('No conectado a MongoDB'), null);
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
 * Busca la transmisión con el CRC de SAP (el de 8 dígitos pasado a decimal) indicado.
 * Si la intención es saber si un CRC está duplicado, es mejor utilizar la funcion 'esDuplicado()'
 * @param {*} txId 
 * @param {*} crc 
 * @param {*} callback 
 */
const porCrcSap = (txId, crc, callback) => {
	_consultaUnaTransmision(txId, { crcSap: crc }, callback);
};


/**
 * Busca la transmisión con el CRC dado y llama al callback con el ID de la transmisión original 
 * si la encuentra o false de no encontrarla.
 * @param {*} txId
 * @param {*} crc 
 * @param {*} callback 
 */
const duplicadoDeCRC = (txId, crc, callback) => {

	return new Promise(async function (resolve, reject) {
		try {
			crc = new M.ObjectID(crc);
		} catch (excepcionObjectID) {
			L.xe(txId, ['El CRC de la transmisión no es un ObjectID válido', crc, excepcionObjectID]);
			reject(excepcionObjectID);
			return;
		}

		try {
			let fechaLimite = new Date();
			fechaLimite.setTime(fechaLimite.getTime() - K.LIMITE_DUPLICADOS);

			let consultaCRC = {
				crc: crc,
				createdAt: { $gt: fechaLimite }
			}

			let resultado = await M.col.tx.findOne(consultaCRC, { _id: 1 });

			if (resultado) resolve(resultado._id);
			else resolve(false);


		} catch (errorMongo) {
			L.xe(txId, ['Error al ejecutar la consulta de duplicados.', errorMongo]);
			reject(errorMongo);
		}
	});
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
		numeroDevolucion: numeroDevolucion
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
		callback(new Error('No conectado a MongoDB'), null);
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
		callback(new Error('No conectado a MongoDB'), null);
	}
}



module.exports = {
	//consulta,
	//agregacion,

	//porId,
	//porCRC,
	//porCrcSap,

	//porNumeroPedido,
	//porNumeroDevolucion,
	//porNumeroLogistica,

	duplicadoDeCRC,

	//porCRCDeConfirmacion,
	//candidatasParaRetransmitir
}

const _consultaUnaTransmision = (txId, filtro, callback) => {
	if (MDB.colTx()) {
		L.xd(txId, ['Buscando transmisión', filtro], 'mongodb');
		MDB.colTx().findOne(filtro, callback);
	} else {
		L.xe(txId, ['Error al localizar la transmisión'], 'mongodb');
		callback(new Error('No conectado a MongoDB'), null);
	}
}