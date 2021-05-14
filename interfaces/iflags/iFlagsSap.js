'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


const iFlagsComun = require('./iFlagsComun');

/*
{
  sap: {
    servidor: "sap1p01",
    tiempoRespuesta: 42394
  }
}
*/


exports.generaFlags = (txId, respuestaSap, tipoError = null) => {

	let flag = {
		servidor: null,
		tiempoRespuesta: null,
		codigoEstado: null
	}

	if (tipoError) flag.error = tipoError;

	if (respuestaSap) {

		if (respuestaSap.headers?.['x-servidor-sap']) {
			flag.servidor = respuestaSap.headers['x-servidor-sap'].toLowerCase?.();
		}

		if (respuestaSap.headers?.['sap-perf-fesrec']) {
			flag.tiempoRespuesta = parseInt(respuestaSap.headers['sap-perf-fesrec']) || null;
		}

		flag.codigoEstado = respuestaSap.status ?? null;
	
	}
	

	iFlagsComun.set(txId, 'sap', flag);

}

exports.quitarError = (txId) => {

	let flags = iFlagsComun.get(txId)
	let flagSap = flags?.sap;

	if (flagSap) {
		delete flagSap.error;
		iFlagsComun.set(txId, 'sap', flagSap);
	}
	
}