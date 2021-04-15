'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Externas


// Interfaces
const iTokens = require('global/tokens');

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');


// GET /balanceadores ? [tipo=sap|fedicom]
const listadoBalanceadores = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Consulta del estado de los balanceadores', req.query]);

	let estadoToken = iTokens.verificaPermisos(req, res);
	if (!estadoToken.ok) return;

	let tipoBalanceador = req.query.tipo || null;


	let balanceadores = C.balanceador.balanceadores;
	if (tipoBalanceador)
		balanceadores = balanceadores.filter(balanceador => balanceador.tipo === tipoBalanceador);

	let promesas = balanceadores.map(balanceador => balanceador.consultaEstado());
	let resultados = await Promise.allSettled(promesas);

	resultados = resultados.map(resultado => {
		return {
			ok: resultado.status === 'fulfilled',
			resultado: resultado.value || resultado.reason.message
		}
	})
	res.status(200).json(resultados);

}



// GET /balanceadores/:servidor
const consultaBalanceador = async function (req, res) {

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

	let balanceador = C.balanceador.get(servidor);
	if (!balanceador) {
		L.xi(txId, ['El balanceador indicado no existe']);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'El balanceador indicado no existe', 404);
		return;
	}

	try {
		let datosBalanceador = await balanceador.consultaEstado();
		res.status(200).json(datosBalanceador);
	} catch (errorConsulta) {
		L.xe(txId, ['La consulta del estado ha fallado', errorConsulta]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al consultar el estado del balanceador', 500);
	}



}

// PUT /balanceadores/:servidor
/**
	{
		grupoBalanceo: "sapt01",
		worker: "http://sap1t01:8000", 
		estado: {
			stop: false, 
			standby: false
		}, 
		peso: 1
	}
 */

const actualizaBalanceador = async function (req, res) {

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

	let balanceador = C.balanceador.get(servidor);
	if (!balanceador) {
		L.xi(txId, ['El balanceador indicado no existe']);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'El balanceador indicado no existe', 404);
		return;
	}

	let peticion = req.body || {};

	try {
		let resultado = await balanceador.actualizarEstado(peticion.grupoBalanceo, peticion.worker, peticion.estado, peticion.peso);
		res.status(200).json(resultado);
	} catch (errorBalanceador) {
		L.xe(txId, ['Error al actualizar el balanceador', errorBalanceador]);
		ErrorFedicom.generarYEnviarErrorMonitor(res, 'Error al actualizar el balanceador', 500);
	}



}




module.exports = {
	listadoBalanceadores,
	consultaBalanceador,
	actualizaBalanceador
}

