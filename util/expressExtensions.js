'use strict';
//const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;

var MongoDB = require('mongodb');
const clone = require('clone');
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

const limpiarIp = (ip) => {
	if (ip.startsWith('::ffff:'))
		return ip.slice(7, ip.length);
	return ip;
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

	req.originIp = limpiarIp(req.originIp);

	req.identificarClienteSap = () => identificarClienteSap(req);
	req.identificarUsuarioAutenticado = () => identificarUsuarioAutenticado(req);

	return [req, res];
}

const extendReqForRtx = (req) => {
	let reqClon = clone(req);
	reqClon.txId = new ObjectID();
	reqClon.originIp = 'RTX';
	let nuevasCabeceras = {};
	if (reqClon.headers) {
		['authorization'].forEach( key => {
			nuevasCabeceras[key] = req.headers[key];
		})
	}

	nuevasCabeceras['software-id'] = K.SOFTWARE_ID.RETRANSMISOR
	reqClon.headers = nuevasCabeceras;


	reqClon.identificarClienteSap = () => identificarClienteSap(reqClon);
	reqClon.identificarUsuarioAutenticado = () => identificarUsuarioAutenticado(reqClon);
	return reqClon;
}





module.exports = {
	extendReqAndRes: extendReqAndRes,
	extendReqForRtx
}