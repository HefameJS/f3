'use strict';
////const C = global.config;
//const L = global.logger;
//const K = global.constants;

// Externos
const memoryCache = require('memory-cache');


const cacheCredencialesFedicom = new memoryCache.Cache();
cacheCredencialesFedicom.countStats(true);


const chequearSolicitud = (solicitudAutenticacion) => {
	let passwordEnCache = cacheCredencialesFedicom.get(solicitudAutenticacion.username);
	return (passwordEnCache && passwordEnCache === solicitudAutenticacion.password)
}

const agregarEntrada = (solicitudAutenticacion) => {
	cacheCredencialesFedicom.put(solicitudAutenticacion.username, solicitudAutenticacion.password);
}

const estadisticas = () => {
	let aciertos = cacheCredencialesFedicom.hits();
	let fallos = cacheCredencialesFedicom.misses();
	let total = aciertos + fallos;
	let ratio = total ? (aciertos * 100) / total : 0;

	return {
		hit: aciertos,
		miss: fallos,
		entries: cacheCredencialesFedicom.size(),
		hitRatio: ratio
	};
}

const clear = () => {
	cacheCredencialesFedicom.clear();
}


module.exports = {
	chequearSolicitud,
	agregarEntrada,
	estadisticas
}
