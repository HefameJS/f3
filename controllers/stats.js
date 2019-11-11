'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;

const credentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');
const Isqlite = require(BASE + 'interfaces/isqlite');
const Imongo = require(BASE + 'interfaces/imongo');
const Isap = require(BASE + 'interfaces/isap');

module.exports.getStats = function (req, res) {
	var item = req.params.item || req.query.item;
	if (!item) {
		res.status(400).send({ok: false,	msg: 'Debe especificar un elemento'});
		return;
	}


	if (req.params.item === 'sqlite') {
	
		Isqlite.countTx(null, (err, numRows) => {
			if (err) return res.status(500).send({ok: false, msg: err});
			
			Isqlite.countTx(10, (err, pendingRows) => {
				res.status(200).json({
					ok: true,
					data: {
						totalEntries: numRows,
						activeEntries: pendingRows
					}
				});
			});

		});
	} else if(req.params.item === 'fedicomCredentialsCache') {
		res.status(200).json(credentialsCache.stats());
	}
	else if(req.params.item === 'mdbStatus') {
		Imongo.connectionStatus( (status) => {
			res.status(200).json({ok: true, data: {connected: status }});
		});	
	}
	else if (req.params.item === 'sap') {
		Isap.ping(req.query.sapSystem || null, (err, status) => {
			if (!err) {
				res.status(200).json({ ok: true, data: { available: status } });
			} else {
				res.status(200).json({ ok: true, data: { available: status, error: err } });
			}
		});
	}
	else {
		res.status(404).json({ok: false, msg: 'Elemento no encontrado'});
	}

}

