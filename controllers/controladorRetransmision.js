'use strict';
const L = global.logger;
//const C = global.config;
//const K = global.constants;

// Interfaces
const iTokens = require('util/tokens');

// Helpers
const retransmitirPedido = require('watchdog/retransmitirPedido').retransmitirPedido;

// GET /retransmitir/:txId
exports.retransmitePedido = (req, res) => {

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
		sistemaSAP: req.query.sistemaSAP ? req.query.sistemaSAP : undefined
	}
	retransmitirPedido(txId, opcionesRetransmision, (err, rtxId, ctxId) => {
		res.status(200);
		if (err) {
			res.json({
				ok: false,
				err: err
			});
			return;
		}
		res.json({
			ok: true,
			data: { otxId: txId, rtxId, ctxId }
		});
		return;


	});

}
