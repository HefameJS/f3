'use strict';
const C = global.config;
const L = global.logger;
const M = global.mongodb;

const MAESTRO = require("global/maestro");

let idIntervalo = null;


module.exports = async function() {

	let intervaloEnEjecucion = false;

	const funcionListaNegra = async () => {
		intervaloEnEjecucion = true;
		try {
			
			let listaNegra = await M.bd.collection('configuracion').findOne({_id: "listaNegra"});

			if (listaNegra && Array.isArray(listaNegra.clientes)) {
				MAESTRO.listaNegra.clientes = listaNegra.clientes
			}

			L.t(['Lista negra de clientes actualizada', listaNegra.clientes]);
		} catch (errorMongo) {
			L.e(['Capturado error al recuperar la lista negra de clientes', errorMongo]);
		} finally {
			intervaloEnEjecucion = false;
		}


	}

	idIntervalo = setInterval(funcionListaNegra,  C.listaNegra.intervaloRefresco);
	funcionListaNegra();

	return idIntervalo;
}