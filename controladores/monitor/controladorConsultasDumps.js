'use strict';
//const C = global.config;
const L = global.logger;
// const K = global.constants;

// Externas
const OS = require('os');

// Interfaces
const iTokens = require('global/tokens');
const iMonitor = require('interfaces/iMonitor');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const Dump = require('modelos/log/ModeloDump');


// GET /dumps
const listadoDumps = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Listado de Dumps', req.query]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;


	if (req.query.servidor === 'local') {

		Dump.listadoDumpsLocales((errorListadoDumps, dumps) => {
			if (errorListadoDumps) {
				L.xe(txId, ['Ocurrió un error al obtener la lista de dumps', errorListadoDumps]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de dumps');
				return;
			}
			res.status(200).send(dumps);
		});

	} else {

		iMonitor.realizarLlamadaMultiple(req.query.servidor, '/v1/dumps?servidor=local', (errorLlamada, respuestasRemotas) => {
			if (errorLlamada) {
				L.xe(txId, ['Ocurrió un error al obtener la lista de dumps', errorLlamada]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al obtener la lista de dumps');
				return;
			}

			res.status(200).send(respuestasRemotas);
		})

	}


}


// GET /dumps/:idDump
const consultaDump = (req, res) => {

	let txId = req.txId;

	let idDump = req.params.idDump;

	L.xi(txId, ['Consulta de Dump', idDump]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let dump = new Dump(idDump);

	if (dump.servidor === OS.hostname()) {

		dump.leerContenidoFichero((errorLecturaFichero, contenido) => {
			if (errorLecturaFichero) {
				L.xe(txId, ['Ocurrió un error al obtener el contenido del dump', errorLecturaFichero])
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se pudo obtener el contenido del fichero de dump', 404);
				return;
			}

			res.status(200).send(dump)
		})
	}
	else {
		iMonitor.realizarLlamadaMultiple(dump.servidor, '/v1/dumps/' + idDump, (errorLlamada, respuestasRemotas) => {
			if (errorLlamada) {
				L.xe(txId, ['Ocurrió un error al obtener información del fichero de dump', errorLlamada]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al obtener información del fichero de dump');
				return;
			}

			// En la consulta de un dump remoto, queremos que la respuesta sea siempre en el formato que se devuelve como si se realiza la consulta local
			if (respuestasRemotas[dump.servidor].ok) {
				res.status(200).send(respuestasRemotas[dump.servidor].respuesta);
			} else {
				res.status(200).send(respuestasRemotas[dump.servidor].error);
			}
			
		})
	}






}


module.exports = {
	listadoDumps,
	consultaDump
}

