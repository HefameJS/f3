'use strict';
//const C = global.config;
const L = global.logger;
// const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');

// Modelos
const Dump = require('model/log/ModeloDump');


// GET /dumps
const listadoDumps = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Listado de Dumps', req.query]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let funcionRecoleccionDumps = null;
	if (req.query.local === 'si') {
		funcionRecoleccionDumps = Dump.listadoDumpsLocales;
	} else {
		funcionRecoleccionDumps = Dump.listadoDumps;
	}


	funcionRecoleccionDumps((errorListadoDumps, dumps) => {
		if (errorListadoDumps) {
			L.xe(txId, ['Ocurrió un error al obtener la lista de dumps', errorListadoDumps]);
			res.status(500).send({ ok: false, error: 'Error al obtener la lista de dumps' });
			return;
		}
		res.status(200).send({ ok: true, data:  dumps  });
	});

}


// GET /dumps/:idDump
const consultaDump = (req, res) => {

	let txId = req.txId;

	let idDump = req.params.idDump;

	L.xi(txId, ['Consulta de Dump', idDump]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let dump = new Dump(idDump);

	dump.leerContenidoFichero( (error, contenido) => {

		if (error) {
			L.xe(txId, ['Ocurrió un error al obtener el contenido del dump', error])
			res.status(404).send({ok: false, error: 'No se pudo obtener el contenido del fichero de dump'})
			return;
		}

		res.status(200).send({ok: true, data: dump})

	} )


}


module.exports = {
	listadoDumps,
	consultaDump
}

