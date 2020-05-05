'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');
const iApache = require('interfaces/apache/iapache');
const iRegistroProcesos = require('interfaces/procesos/iRegistroProcesos');


// GET /balanceadores
const listadoBalanceadores = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta del estado de los balanceadores', req.query]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let subtipoBalanceador = req.query.tipo || null;
	let host  = req.query.host || null;

	iRegistroProcesos.consultaProcesos(K.PROCESS_TYPES.BALANCEADOR, host, (errorConsultaProcesos, balanceadores) => {
		if (errorConsultaProcesos) {
			L.xe(txId, ['Ocurrió un error al consultar la lista de procesos de tipo balanceador', errorConsultaProcesos]);
			res.status(500).json({ ok: false, error: 'No se pudo obtener la información de los balanceadores' });
			return;
		}

		if (subtipoBalanceador) {
			balanceadores = balanceadores.filter( balanceador => balanceador.subtype === subtipoBalanceador);
		}

		if (!balanceadores.length) {
			L.xi(txId, ['No se encontraron balanceadores']);
			res.status(404).json({ ok: false, error: 'No se encontraron balanceadores' });
			return;
		}

		L.xd(txId, ['Se van a consultar los balanceadores', balanceadores])

		let datosBalanceadores = []
		let consultasPendientes = balanceadores.length;

		const funcionAgregacion = (balanceador, errorConsultaBalanceador, datosBalanceo) => {
			if (errorConsultaBalanceador) {
				L.xe(txId, ['Error al consultar el balanceador', balanceador, errorConsultaBalanceador]);
				balanceador.ok = false;
				balanceador.error = 'Error al consultar el balanceador: ' + errorConsultaBalanceador.message;
				datosBalanceadores.push(balanceador);
			} else {
				balanceador.ok = true;
				balanceador.balanceadores = datosBalanceo;
				datosBalanceadores.push(balanceador);
			}

			consultasPendientes--;
			if (consultasPendientes === 0) {
				res.status(200).json({ ok: true, data: datosBalanceadores });
			}

		}

		balanceadores.forEach( balanceador => {
			iApache.consultaBalanceador(balanceador.url, (errorApache, datosBalanceador) => {
				funcionAgregacion(balanceador, errorApache, datosBalanceador);
			})
		})

	});
}




// GET /balanceadores/:servidor
const consultaBalanceador = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Petición de consulta de un balanceador', req.params.servidor]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let servidor = req.params.servidor || null;

	if (!servidor) {
		L.xi(txId, ['No se especifica el servidor']);
		res.status(400).json({ ok: false, error: 'Debe especificar el servidor de balanceo' });
		return;
	}

	iRegistroProcesos.consultaProcesos(K.PROCESS_TYPES.BALANCEADOR, servidor, (errorConsultaProcesos, balanceadores) => {
		if (errorConsultaProcesos) {
			L.xe(txId, ['Ocurrió un error al consultar la lista de procesos de tipo balanceador', errorConsultaProcesos]);
			res.status(500).json({ ok: false, error: 'No se pudo obtener la información del balanceador' });
			return;
		}

		if (balanceadores.length === 0) {
			L.xi(txId, ['No se encontraró el balanceador']);
			res.status(404).json({ ok: false, error: 'No se encontraró el balanceador' });
			return;
		}

		if (balanceadores.length > 1) {
			L.xw(txId, ['La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido', errorConsultaProcesos]);
			res.status(500).json({ ok: false, error: 'La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido - Utiliza el filtro tipo=[sap|fedicom] para afinar la búsqueda' });
			return;
		}


		let balanceador = balanceadores[0];

		iApache.consultaBalanceador(balanceador.url, (errorApache, datosBalanceador) => {
			if (errorApache) {
				L.e(['Error al consultar el balanceador', errorApache]);
				res.status(500).json({ ok: false, error: 'Error al consultar el balanceador: ' + errorApache.message });
			} else {
				balanceador.ok = true;
				balanceador.balanceadores = datosBalanceador;
				res.status(200).json({ ok: true, data: balanceador });
			}
		})

	})

}


// PUT /balanceadores/:servidor
const actualizaBalanceador = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Petición para actualizar un balanceador', req.params.servidor]);

	let estadoToken = iTokens.verificaPermisos(req, res, { grupoRequerido: 'FED3_BALANCEADOR' });
	if (!estadoToken.ok) return;

	let servidor = req.params.servidor || null;

	if (!servidor) {
		L.xi(txId, ['No se especifica el servidor']);
		res.status(400).json({ ok: false, error: 'Debe especificar el servidor de balanceo' });
		return;
	}

	iRegistroProcesos.consultaProcesos(K.PROCESS_TYPES.BALANCEADOR, servidor, (errorConsultaProcesos, balanceadores) => {
		if (errorConsultaProcesos) {
			L.xe(txId, ['Ocurrió un error al consultar la lista de procesos de tipo balanceador', errorConsultaProcesos]);
			res.status(500).json({ ok: false, error: 'No se pudo obtener la información del balanceador' });
			return;
		}

		if (balanceadores.length === 0) {
			L.xi(txId, ['No se encontraró el balanceador']);
			res.status(404).json({ ok: false, error: 'No se encontraró el balanceador' });
			return;
		}

		if (balanceadores.length > 1) {
			L.xw(txId, ['La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido', errorConsultaProcesos]);
			res.status(500).json({ ok: false, error: 'La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido - Utiliza el filtro tipo=[sap|fedicom] para afinar la búsqueda' });
			return;
		}

		let balanceador = balanceadores[0];
		let peticion = req.body;

		L.xi(txId, ['Solicitud de cambio de balanceador', peticion])

		iApache.actualizarWorker(balanceador.url, peticion.balanceador, peticion.worker, peticion.nonce, peticion.estado, peticion.peso, (errorApache, datosBalancadorNuevos) => {
			if (errorApache) {
				L.e(['Error al cambiar el estado del balanceador', errorApache]);
				res.status(500).json({ ok: false, error: 'Error al cambiar el estado del balanceador: ' + errorApache.message });
			} else {
				balanceador.ok = true;
				balanceador.balanceadores = datosBalancadorNuevos;
				res.status(200).json({ ok: true, data: balanceador });
			}
		})

	})

}




module.exports = {
	listadoBalanceadores,
	consultaBalanceador,
	actualizaBalanceador
}

