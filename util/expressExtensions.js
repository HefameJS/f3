'use strict';
//const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;

var MongoDB = require('mongodb');
var ObjectID = MongoDB.ObjectID;

const identificarUsuarioAutenticado = (req) => {
	if (req.token && req.token.sub) {
		return req.token.sub;
	}
	if (req.body && req.body.user) {
		return req.body.user
	}
	return undefined;
}

const identificarClienteSap = (req) => {
	if (req.body && req.body.codigoCliente) {
		return req.body.codigoCliente;
	}
	return undefined;
}

const extendReqAndRes = (req, res) => {

	var txId = new ObjectID();

	req.txId = res.txId = txId;

	res.setHeader('X-TxID', txId);
	res.setHeader('Software-ID', K.SOFTWARE_ID.HEFAME);
	res.setHeader('Content-Api-Version', K.PROTOCOL_VERSION);


	if (req.headers && req.headers['x-forwarded-for'])
		req.originIp = req.headers['x-forwarded-for'];
	else
		req.originIp = req.ip

	req.identificarClienteSap = () => identificarClienteSap(req);
	req.identificarUsuarioAutenticado = () => identificarUsuarioAutenticado(req);

	return [req, res];
}


module.exports = {
	extendReqAndRes: extendReqAndRes
}