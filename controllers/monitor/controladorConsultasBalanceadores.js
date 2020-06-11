'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Externas
const lock = require('locks');

// Interfaces
const iTokens = require('util/tokens');
const iApache = require('interfaces/apache/iapache');
const iRegistroProcesos = require('interfaces/procesos/iRegistroProcesos');

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');


// GET /balanceadores ? [servidor=f3dev1] & [tipo=sap|fedicom]
const listadoBalanceadores = (req, res) => {

	let txId = req.txId;

	L.xi(txId, ['Consulta del estado de los balanceadores', req.query]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let subtipoBalanceador = req.query.tipo || null;
	let servidor = req.query.servidor || null;

	iRegistroProcesos.consultaProcesos(K.PROCESS_TYPES.BALANCEADOR, servidor, (errorConsultaProcesos, balanceadores) => {
		if (errorConsultaProcesos) {
			L.xe(txId, ['Ocurrió un error al consultar la lista de procesos de tipo balanceador', errorConsultaProcesos]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'Ocurrió un error al consultar la lista de procesos de tipo balanceador');
			return;
		}

		if (subtipoBalanceador) {
			balanceadores = balanceadores.filter(balanceador => balanceador.subtype === subtipoBalanceador);
		}

		if (!balanceadores.length) {
			L.xi(txId, ['No se encontraron balanceadores']);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se encontraron balanceadores', 404);
			return;
		}

		L.xd(txId, ['Se van a consultar los balanceadores', balanceadores])

		let datosBalanceadores = []
		let consultasPendientes = balanceadores.length;
		let mutex = lock.createMutex();

		const funcionAgregacion = (balanceador, errorConsultaBalanceador, datosBalanceo) => {
			if (errorConsultaBalanceador) {
				L.xe(txId, ['Error al consultar el balanceador', balanceador, errorConsultaBalanceador.message]);
				balanceador.ok = false;
				balanceador.error = 'Error al consultar el balanceador: ' + errorConsultaBalanceador.message;
				datosBalanceadores.push(balanceador);
			} else {
				balanceador.ok = true;
				balanceador.balanceadores = datosBalanceo;
				datosBalanceadores.push(balanceador);
			}

			mutex.lock(() => {
				consultasPendientes--;
				if (consultasPendientes === 0) {
					res.status(200).json(datosBalanceadores);
				}
				mutex.unlock();
			})

		}

		balanceadores.forEach(balanceador => {
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
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Debe especificar el servidor de balanceo', 400);
		return;
	}

	iRegistroProcesos.consultaProcesos(K.PROCESS_TYPES.BALANCEADOR, servidor, (errorConsultaProcesos, balanceadores) => {
		if (errorConsultaProcesos) {
			L.xe(txId, ['No se pudo obtener la información del balanceado', errorConsultaProcesos]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se pudo obtener la información del balanceador');
			return;
		}

		if (balanceadores.length === 0) {
			L.xi(txId, ['No se encontró el balanceador']);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se encontró el balanceador', 404);
			return;
		}

		if (balanceadores.length > 1) {
			L.xw(txId, ['La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido', errorConsultaProcesos]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido - Utiliza el filtro tipo=[sap|fedicom] para afinar la búsqueda', 400);
			return;
		}


		let balanceador = balanceadores[0];

		iApache.consultaBalanceador(balanceador.url, (errorApache, datosBalanceador) => {
			if (errorApache) {
				L.e(['Error al consultar el balanceador', errorApache]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al consultar el balanceador: ' + errorApache.message);
			} else {
				balanceador.ok = true;
				balanceador.balanceadores = datosBalanceador;
				res.status(200).json(balanceador);
			}
		})

	})

}

// PUT /balanceadores/:servidor
/**
	{
		balanceador: "sapt01", 
		worker: "http://sap1t01:8000", 
		nonce: "xxx", 
		estado: {
			stop: false, 
			standby: false
		}, 
		peso: 1
	}
 */
const actualizaBalanceador = (req, res) => {

	let txId = req.txId;
	L.xi(txId, ['Petición para actualizar un balanceador', req.params.servidor]);

	let estadoToken = iTokens.verificaPermisos(req, res, { grupoRequerido: 'FED3_BALANCEADOR' });
	if (!estadoToken.ok) return;

	let servidor = req.params.servidor || null;

	if (!servidor) {
		L.xi(txId, ['No se especifica el servidor']);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Debe especificar el servidor de balanceo', 400);
		return;
	}

	iRegistroProcesos.consultaProcesos(K.PROCESS_TYPES.BALANCEADOR, servidor, (errorConsultaProcesos, balanceadores) => {
		if (errorConsultaProcesos) {
			L.xe(txId, ['Ocurrió un error al consultar la lista de procesos de tipo balanceador', errorConsultaProcesos]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se pudo acceder a la información del balanceador');
			return;
		}

		if (balanceadores.length === 0) {
			L.xi(txId, ['No se encontró el balanceador']);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'No se encontró el balanceador', 404);
			return;
		}

		if (balanceadores.length > 1) {
			L.xw(txId, ['La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido', errorConsultaProcesos]);
			ErrorFedicom.generarYEnviarErrorMonitor(res, 'La consulta de procesos de tipo balanceador retornó mas de un balanceador, lo cual no está permitido - Utiliza el filtro tipo=[sap|fedicom] para afinar la búsqueda', 400);
			return;
		}

		let balanceador = balanceadores[0];
		let peticion = req.body;

		L.xi(txId, ['Solicitud de cambio de balanceador', peticion])

		iApache.actualizarWorker(balanceador.url, peticion.balanceador, peticion.worker, peticion.nonce, peticion.estado, peticion.peso, (errorApache, datosBalancadorNuevos) => {
			if (errorApache) {
				L.e(['Error al cambiar el estado del balanceador', errorApache]);
				ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al cambiar el estado del balanceador: ' + errorApache.message);
			} else {
				balanceador.ok = true;
				balanceador.balanceadores = datosBalancadorNuevos;
				res.status(200).json(balanceador);
			}
		})

	})

}




module.exports = {
	listadoBalanceadores,
	consultaBalanceador,
	actualizaBalanceador
}

