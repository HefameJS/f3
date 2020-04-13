'use strict';
//const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;


/**
 * Condensa en un solo objeto la respuesta dada por SAP.
 * La respuesta de SAP se completa adjuntando la propiedad body el cuerpo de la respuesta
 * y una propiedad que indica si hubo error en la respuesta de SAP (codigo respuesta HTTP distinto de 2xx)
 */
const ampliaRespuestaSap = (repuestaSap, cuerpoSap) => {
	if (!repuestaSap) repuestaSap = {};
	repuestaSap.body = cuerpoSap;
	repuestaSap.errorSap = Math.floor(repuestaSap.statusCode / 100) !== 2;
	return repuestaSap;
}

const NO_SAP_SYSTEM_ERROR = {
	type: K.ISAP.ERROR_TYPE_NO_SAPSYSTEM,
	errno: null,
	code: 'No se encuentra definido el sistema SAP destino'
}



module.exports = {
	NO_SAP_SYSTEM_ERROR,
	ampliaRespuestaSap
}