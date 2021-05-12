'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


const iFlagsComun = require('./iFlagsComun');

/*
{
  transmision: {
    ip: "1.1.1.1",
    autenticacion: {
      usuario: "10107560@hefame",
      dominio: "FEDICOM"
    },
    programa: 12,
    ssl: {
      protocolo: "TLSv1.2",
      suite: "ECDHE-RSA-AES128-GCM-SHA256"
    },
    balanceador: "f3san1-fw",
    concentrador: {
            servidor: "cpd25",
      pid: 26824,
      version: "0.14.2",
      git: {
        commit: "f0d3ac9e4bc8f1bfb63e44e3a4b2de20afd457f6",
        timestamp: 1620735148821
      }
    }
  }
}
*/


exports.generaFlags = (req) => {

	let flag = {
		ip: req.obtenerDireccionIp(),
		autenticacion: req.identificarUsuarioAutenticado(),
		programa: req.identificarProgramaFarmacia(),
		ssl: req.obtenerDatosSSL(),
		balanceador: req.obtenerNombreBalanceador(),
		concentrador: req.obtenerDatosConcentrador()
	}


	iFlagsComun.set(req.txId, 'transmision', flag);

}