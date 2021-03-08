'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;



const consulta = async function (consulta) {

	let filtro = consulta.filtro || {};
	let proyeccion = consulta.proyeccion || null;
	let orden = consulta.orden || null;
	let skip = consulta.skip || 0;
	let limite = Math.min(consulta.limite || 50, 50);


	// No se admiten '$or' vacíos, mongo peta
	if (filtro.$or && filtro.$or.length === 0) {
		delete filtro.$or;
	}


	let cursor = M.col.tx.find(filtro);
	if (proyeccion) cursor.project(proyeccion);
	if (orden) cursor.sort(orden);
	if (skip) cursor.skip(skip);
	if (limite) cursor.limit(limite);


	let count = await cursor.count(false);
	let resultados = await cursor.toArray();

	return {
		resultados: resultados,
		limite: limite,
		skip: skip,
		total: count
	}


}


const agregacion = async function (pipeline) {
	return await M.col.tx.aggregate(pipeline).toArray();
}

/**
 * Busca la transmisión con el ID indicado
 * @param {*} id 
 */
const porId = async function (id) {
	let idOid = new M.ObjectID(id);
	return await M.col.tx.findOne({ _id: idOid });
};

/**
 * Busca la transmisión con el CRC indicado.
 * Si la intención es saber si un CRC está duplicado, es mejor utilizar la funcion 'duplicadoDeCRC()'
 * @param {*} crc 
 */
const porCRC = async function (crc) {
	let crcOid = new M.ObjectID(crc);
	return await M.col.tx.findOne({ crc: crcOid });
};


/**
 * Busca la transmisión con el CRC de SAP (el de 8 dígitos pasado a decimal) indicado.
 * Si la intención es saber si un CRC está duplicado, es mejor utilizar la funcion 'duplicadoDeCRC()'
 * @param {*} crcSap 
 */
const porCrcSap = async function (crcSap) {
	return await M.col.tx.findOne({ crcSap: crcSap });
};


/**
 * Busca la transmisión con el CRC dado y retorna el ID de la transmisión original 
 * si la encuentra o false de no encontrarla.
 * @param {*} txId
 * @param {*} crc 
 */
const duplicadoDeCRC = (txId, crc) => {

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
			fechaLimite.setTime(fechaLimite.getTime() - C.pedidos.antiguedadDuplicadosMaxima);

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

const porNumeroPedido = async function (numeroPedido) {
	let filtro = {
		type: K.TX_TYPES.PEDIDO,
		numerosPedido: numeroPedido
	};

	return await M.col.tx.findOne(filtro);
};

const porNumeroDevolucion = async function (numeroDevolucion) {
	let filtro = {
		type: K.TX_TYPES.DEVOLUCION,
		numeroDevolucion: numeroDevolucion
	};

	return await M.col.tx.findOne(filtro);
};

const porNumeroLogistica = async function (numeroLogistica) {
	let filtro = {
		type: K.TX_TYPES.LOGISTICA,
		numeroLogistica: numeroLogistica
	};

	return await M.col.tx.findOne(filtro);
};

const porCRCDeConfirmacion = async function (crcSap) {
	let filtro = {
		type: K.TX_TYPES.CONFIRMACION_PEDIDO,
		crcSap: crcSap
	};

	return await M.col.tx.findOne(filtro);
};

/**
 * Obtiene las transmisiones que son candidatas para ser retransmitidas por el watchdog
 * @param {*} limite Se retornarán como máximo este número de candidatas. Por defecto 10.
 * @param {*} antiguedadMinima Solo retornará como candidatas aquellas candidatas que tengan más de este número de segundos.
 * @param {*} callback 
 */
const candidatasParaRetransmitir = async function (limite, antiguedadMinima) {

	let consulta = {
		type: K.TX_TYPES.PEDIDO,		// Solo los pedidos son candidatos a retransmisión automática
		'$or': [
			{							// Que o bien estén en estado NO SAP ...
				status: K.TX_STATUS.NO_SAP
			},
			{							// .. o que esten en un estado intermedio durante al menos 'antiguedadMinima' segundos.
				status: { '$in': [K.TX_STATUS.RECEPCIONADO, K.TX_STATUS.ESPERANDO_INCIDENCIAS, K.TX_STATUS.INCIDENCIAS_RECIBIDAS, K.TX_STATUS.PEDIDO.ESPERANDO_NUMERO_PEDIDO] },
				modifiedAt: { $lt: new Date(Date.fedicomTimestamp() - antiguedadMinima) }
			}
		]
	};

	limite = limite || 10;
	return await M.col.tx.find(consulta).limit(limite).toArray();

}


module.exports = {
	consulta,
	agregacion,

	porId,
	porCRC,
	porCrcSap,

	porNumeroPedido,
	porNumeroDevolucion,
	porNumeroLogistica,

	duplicadoDeCRC,

	porCRCDeConfirmacion,
	candidatasParaRetransmitir
}
