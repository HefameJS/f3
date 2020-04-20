'use strict';
//const BASE = global.BASE;
//const C = global.config;
//const L = global.logger;
const K = global.constants;

var MongoDB = require('mongodb');
const clone = require('clone');
var ObjectID = MongoDB.ObjectID;


const _identificarUsuarioAutenticado = (req) => {
	if (req.token && req.token.sub) {
		return req.token.sub;
	}
	if (req.body && req.body.user) {
		return req.body.user
	}
	return undefined;
}

const _identificarClienteSap = (req) => {
	if (req.body && req.body.codigoCliente) {
		return req.body.codigoCliente;
	}
	return undefined;
}

const _limpiarIp = (ip) => {
	if (ip.startsWith('::ffff:'))
		return ip.slice(7, ip.length);
	return ip;
}

const extenderSolicitudHttp = (req, res) => {

	let txId = new ObjectID();
	req.txId = res.txId = txId;

	res.setHeader('X-TxID', txId);
	res.setHeader('Software-ID', K.SOFTWARE_ID.HEFAME);
	res.setHeader('Content-Api-Version', K.PROTOCOL_VERSION);
	if (req.headers && req.headers['x-forwarded-for'])
		req.originIp = req.headers['x-forwarded-for'];
	else
		req.originIp = req.ip

	req.originIp = _limpiarIp(req.originIp);

	req.identificarClienteSap = () => _identificarClienteSap(req);
	req.identificarUsuarioAutenticado = () => _identificarUsuarioAutenticado(req);

	return [req, res];
}

const extenderSolicitudRetransmision = (req) => {

	// Hacemos un clon de la solicitud, que vamos a preparar para entrar al flujo normal
	// de transmisiones como una transmisión nueva.
	
	let reqClon = clone(req);
	reqClon.txId = new ObjectID();
	reqClon.originIp = 'RTX';
	let nuevasCabeceras = {};
	// Solo necesitamos la cabecera 'Authorization'
	if (reqClon.headers) {
		['authorization'].forEach( key => {
			nuevasCabeceras[key] = req.headers[key];
		})
	}

	nuevasCabeceras['software-id'] = K.SOFTWARE_ID.RETRANSMISOR
	reqClon.headers = nuevasCabeceras;


	reqClon.identificarClienteSap = () => _identificarClienteSap(reqClon);
	reqClon.identificarUsuarioAutenticado = () => _identificarUsuarioAutenticado(reqClon);
	return reqClon;
	
}





module.exports = {
	extenderSolicitudHttp,
	extenderSolicitudRetransmision
}