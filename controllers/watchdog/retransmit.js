'use strict';
const BASE = global.BASE;
//const L = global.logger;
//const C = global.config;
//const K = global.constants;

const retransmitirPedido = require(BASE + 'watchdog/retransmitirPedido').retransmitirPedido;


exports.retransmitirPedido = function (req, res) {

	var txId = req.params.txId;

	var retransmissionOptions = {
		force: (req.query.force === 'yes') ? true : false,
		noActualizarOriginal: (req.query.noActualizarOriginal === 'yes') ? true : false,
		regenerateCRC: (req.query.regenerateCRC === 'yes') ? true : false,
		forzarAlmacen: req.query.almacen ? req.query.almacen : undefined,
		sistemaSAP: req.query.sistemaSAP ? req.query.sistemaSAP : undefined
	}
	retransmitirPedido(txId, retransmissionOptions, (err, rtxId) => {
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
			data: { txId, rtxId }
		});
		return;


	});

}
