'use strict';
//const C = global.config;
//const L = global.logger;
const K = global.constants;

// Externas
const MongoDB = require('mongodb');
const clone = require('clone');
const ObjectID = MongoDB.ObjectID;

/**
 * Identifica al usuario que está autenticandose en la petición.
 * El usuario puede aparecer:
 * 	- En el token de autenticación, en el campo 'sub'
 *  - En el cuerpo de la petición, en el campo 'user' - en el caso de peticiones a /authenticate
 * 
 * @param {*} req 
 */
const _identificarUsuarioAutenticado = (req) => {
	if (req.token && req.token.sub) {
		return req.token.sub;
	}
	if (req.body && req.body.user) {
		return req.body.user
	}
	return undefined;
}

/**
 * Identifica el codigo de cliente SAP al que va dirigida la petición.
 * Este código aparecerá en el campo 'codigoCliente' del cuerpo del mensaje.
 * @param {*} req 
 */
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

/**
 * Amplia los objetos de solicitud y respuesta HTTP de Express con utilidades que
 * necesitaremos durante el flujo.
 * 	- req.txId, res.txId -> Genera el ID único de transmisión
 * 	- Establece cabeceras de respuesta estándard Fedicom: Software-ID, Content-Api-Version
 * 	- Establece cabeceras de respuesta no estándard: X-TxID
 *  - req.originIp -> Determina la IP de origen de la solicitud, incluso si la petición entra por proxy inverso.
 * 	- req.identificarClienteSap -> Funcion que determina el código de cliente SAP del cuerpo del mensaje si existe.
 * 	- req.identificarUsuarioAutenticado -> Funcion que determina el código de cliente autenticado en el token, si existe.
 *  * 
 * @param {*} req 
 * @param {*} res 
 */
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

/**
 * Prepara un objeto de solicitud HTTP recuperado de la base de datos para ser retransmitido.
 * - Genera un nuevo txId
 * - Establece la IP de origen al valor especial 'RTX', indicando que es una retransmisión.
 * - Elimina las cabeceras, salvo la del token (Authorization)
 * - Establece la cabecera 'Software-Id' al ID del software retransmisor.
 * - req.identificarClienteSap -> Funcion que determina el código de cliente SAP del cuerpo del mensaje si existe.
 * - req.identificarUsuarioAutenticado -> Funcion que determina el código de cliente autenticado en el token, si existe.
 * 
 * @param {*} req 
 */
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