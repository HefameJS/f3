'use strict';
const BASE = global.BASE;
const L = global.logger;
//const C = global.config;
//const K = global.constants;

const retransmitirPedido = require(BASE + 'watchdog/retransmitirPedido').retransmitirPedido;
const Tokens = require(BASE + 'util/tokens');

exports.retransmitirPedido = function (req, res) {

	var txId = req.params.txId;

	req.token = Tokens.verifyJWT(req.token, txId);
	if (req.token.meta.exception) {
		L.xe(txId, ['El token de la transmisión no es válido. Se transmite el error al cliente', req.token], 'txToken');
		req.token.meta.exception.send(res);
		return;
	}
	if (!req.token.perms || !req.token.perms.includes('FED3_RETRANSMISION')) {
		L.xw(txId, ['El usuario no tiene los permisos necesarios para retransmitir pedidos', req.token.perms])
		var error = new FedicomError('AUTH-005', 'No tienes los permisos necesarios para realizar esta acción', 403);
		error.send(res);
		return;
	}



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
