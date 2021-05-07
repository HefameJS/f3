'use strict';
const L = global.logger;
//const C = global.config;
//const K = global.constants;

// Interfaces
const iTokens = require('global/tokens');

// Helpers
const retransmitirPedido = require('watchdog/retransmitirPedido').retransmitirPedido;

// GET /retransmitir/:txId
exports.retransmitePedido = async function (req, res) {

	let txId = req.params.txId;

	L.xi(txId, ['Procesando transmisión como RETRANSMISION DE PEDIDO']);

	// Verificacion del estado del token
	let estadoToken = iTokens.verificaPermisos(req, res, { requiereGrupo: 'FED3_RETRANSMISION' });
	if (!estadoToken.ok) return;

	let opcionesRetransmision = {
		force: (req.query.forzar === 'si') ? true : false,
		noActualizarOriginal: (req.query.noActualizarOriginal === 'si') ? true : false,
		regenerateCRC: (req.query.regenerateCRC === 'si') ? true : false,
		forzarAlmacen: req.query.almacen ? req.query.almacen : undefined,
	}


	retransmitirPedido(txId, opcionesRetransmision)
		.then(resultado => {
			L.xi(txId, ['Resultado de la retransmisión', resultado])
			res.status(200).send(resultado);
		})
		.catch(error => {
			L.xw(txId, ['Error en la retransmisión', error])
			res.status(200).send(error);
		})



}
