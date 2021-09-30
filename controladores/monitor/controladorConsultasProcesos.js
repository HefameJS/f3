'use strict';
//const C = global.C;
const L = global.L;
//const K = global.K;
const M = global.M;

// Externas
const OS = require('os');

// Interfaces
const iTokens = require('global/tokens');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


// GET /procesos 
module.exports.listadoProcesos = async function (req, res) {

	let txId = req.txId;
	L.xi(txId, ['Consulta de procesos']);

	// Verificación del token del usuario
	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	try {
		let instancias = await M.col.instancias.find({}).toArray();
		let respuesta = {};
		instancias.forEach(({ _id, ...datosInstancia }) => {
			respuesta[_id] = datosInstancia;
		});

		res.status(200).json(respuesta);
	} catch (errorMongo) {
		L.xe(txId, ['Error al obtener la lista de procesos', errorMongo]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de procesos');
	}

}

