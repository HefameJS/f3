'use strict';
const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;

const Tokens = require(BASE + 'util/tokens');
const Isqlite = require(BASE + 'interfaces/isqlite');

const ctrlNumeroEntradasSqlite = (req, res) => {

	let validacionToken = Tokens.validarTransmision(req, res, {dominios: [K.DOMINIOS.HEFAME]})
	if (!validacionToken.ok) return;


	Isqlite.countTx(null, (err, entradasTotales) => {
		if (err) return res.status(500).send({ ok: false, msg: err });

		Isqlite.countTx(10, (err, entradasPendientes) => {
			if (err) return res.status(500).send({ ok: false, msg: err });

			res.status(200).json({
				ok: true,
				data: {
					total: entradasTotales,
					pendientes: entradasPendientes,
					error: entradasTotales - entradasPendientes
				}
			});
		});

	});
}



const ctrlEntradasSqlite = (req, res) => {

	Isqlite.retrieveAll(null, 50, 0, (err, entradas) => {
		if (err) return res.status(500).send({ ok: false, msg: err });
			res.status(200).json({
				ok: true,
				data: entradas
			});
		});
}



module.exports = {
	ctrlNumeroEntradasSqlite,
	ctrlEntradasSqlite
}

