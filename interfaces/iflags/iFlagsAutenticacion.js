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


exports.generaFlags = (solicitudAutenticacion) => {

	let txId = solicitudAutenticacion.txId;
	let flag = {
		aciertoCacheSAP: solicitudAutenticacion.metadatos.aciertoCache
	}

	iFlagsComun.set(txId, 'autenticacion', flag);

}
