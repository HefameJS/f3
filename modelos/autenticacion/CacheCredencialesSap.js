'use strict';
const M = global.M;

// Externos
const Crc = require('global/crc');


const chequearSolicitud = async (solicitudAutenticacion) => {

	const log = solicitudAutenticacion.log;

	log.info('Verificando en caché las credenciales del usuario')
	try {
		let entradaCache = await M.col.cacheUsuarios.findOne({ _id: solicitudAutenticacion.usuario });

		if (entradaCache) {

			let crc = Crc.generar(solicitudAutenticacion.clave, entradaCache.fechaCacheo.getTime(), solicitudAutenticacion.usuario)
			let crcCoindicen = crc.equals(entradaCache.crcClave);
			if (crcCoindicen)
				log.debug('Encontrada entrada en caché para el usuario y coincide con los datos de la solicitud')
			else
				log.warn('La entrada en caché NO coindice con la indicada en la solicitud')
			return crcCoindicen;
		}
		log.debug('No existe la entrada en caché para el usuario')
		return false;
	} catch (error) {
		log.error('Ocurrió un error al comprobar la caché', error)
		return false;
	}

}

const agregarEntrada = async (solicitudAutenticacion) => {

	const log = solicitudAutenticacion.log;
	log.info('Grabando las credenciales del usuario en caché')
	let fechaCacheo = new Date();
	await M.col.cacheUsuarios.updateOne({ _id: solicitudAutenticacion.usuario },
		{
			$setOnInsert: {
				_id: solicitudAutenticacion.usuario,
			},
			$set: {
				fechaCacheo: fechaCacheo,
				crcClave: Crc.generar(solicitudAutenticacion.clave, fechaCacheo.getTime(), solicitudAutenticacion.usuario)
			}
		},
		{ upsert: true })
}


module.exports = {
	chequearSolicitud,
	agregarEntrada,
	//	estadisticas
}
