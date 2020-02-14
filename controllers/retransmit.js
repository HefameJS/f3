'use strict';
const BASE = global.BASE;
//const L = global.logger;
//const C = global.config;
//const K = global.constants;

const retransmitirPedido = require(BASE + 'watchdog/retransmitirPedido').retransmitirPedido;


exports.retransmitirPedido = function (req, res) {

	var txId = req.params.txId;

	var retransmissionOptions = {
		force: (req.query.forzar === 'si') ? true : false,
		noActualizarOriginal: (req.query.noActualizarOriginal === 'si') ? true : false,
		regenerateCRC: (req.query.regenerateCRC === 'si') ? true : false,
		forzarAlmacen: req.query.almacen ? req.query.almacen : undefined,
		sistemaSAP: req.query.sistemaSAP ? req.query.sistemaSAP : undefined
	}
	retransmitirPedido(txId, retransmissionOptions, (err, rtxId, ctxId) => {
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
