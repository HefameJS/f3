'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Externas
const clone = require('clone');
const ErrorFedicom = require('modelos/ErrorFedicom');

/**
 * Identifica al usuario que está autenticandose en la petición.
 * El usuario puede aparecer:
 * 	- En el token de autenticación, en el campo 'sub'
 *  - En el cuerpo de la petición, en el campo 'user' - en el caso de peticiones a /authenticate
 * 
 * @param {*} req 
 */
const _identificarUsuarioAutenticado = (req) => {

	if (req.token?.sub) {
		return {
			usuario: req.token.sub,
			dominio: req.token.aud
		}
	}

	if (req.body?.user) {
		return {
			usuario: req.body.user,
			dominio: req.body.domain || C.dominos.nombreDominioPorDefecto
		}
	}

	return null;
}

/**
 * Identifica el codigo de cliente SAP al que va dirigida la petición.
 * Este código aparecerá en uno de estos sitios: 
 * - En el campo 'codigoCliente' del cuerpo del mensaje.
 * - Como parámetro 'codigoCliente' en la URL query string
 * @param {*} req 
 */
const _identificarClienteSap = (req) => {
	if (req.body?.codigoCliente) return req.body.codigoCliente;
	if (req.query?.codigoCliente) return req.query.codigoCliente;
	return undefined;
}

const _limpiarIp = (ip) => {
	if (ip && ip.startsWith('::ffff:'))
		return ip.slice(7, ip.length);
	return ip;
}

/**
 * Amplia los objetos de solicitud y respuesta HTTP de Express con utilidades que
 * necesitaremos durante el flujo.
 * 	- req.txId, res.txId -> Genera el ID único de transmisión
 * 	- Establece cabeceras de respuesta estándard Fedicom: Software-ID, Content-Api-Version
 * 	- Establece cabeceras de respuesta no estándard: X-TxID
 *  - req.ipOrigen -> Determina la IP de origen de la solicitud, incluso si la petición entra por proxy inverso.
 * 	- req.identificarClienteSap -> Funcion que determina el código de cliente SAP del cuerpo del mensaje si existe.
 * 	- req.identificarUsuarioAutenticado -> Funcion que determina el código de cliente autenticado en el token, si existe.
 *  * 
 * @param {*} req 
 * @param {*} res 
 */
const extenderSolicitudHttp = (req, res) => {

	let txId = new M.ObjectID();
	req.txId = res.txId = txId;

	res.setHeader('X-TxID', txId);
	res.setHeader('Software-ID', C.softwareId.servidor);
	res.setHeader('Content-Api-Version', K.VERSION.PROTOCOLO);
	if (req.headers && req.headers['x-forwarded-for'])
		req.ipOrigen = req.headers['x-forwarded-for'];
	else
		req.ipOrigen = req.ip

	req.ipOrigen = _limpiarIp(req.ipOrigen);

	if (req.headers && req.headers['x-ssl-protocol'])
		req.protocoloSSL = req.headers['x-ssl-protocol'];
	
	if (req.headers && req.headers['x-ssl-cipher'])
		req.suiteSSL = req.headers['x-ssl-cipher'];


	// Deben devolverse como funciones ya que aun no se han analizado los datos de la petición
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
	reqClon.txId = new M.ObjectID();
	reqClon.ipOrigen = 'RTX';
	let nuevasCabeceras = {};
	// Solo necesitamos la cabecera 'Authorization'
	if (reqClon.headers) {
		['authorization' /* Añadir mas cabeceras al array si es necesario */].forEach(key => {
			nuevasCabeceras[key] = req.headers[key];
		})
	}

	nuevasCabeceras['software-id'] = C.softwareId.retransmisor;
	reqClon.headers = nuevasCabeceras;

	// Deben devolverse como funciones ya que aun no se han analizado los datos de la petición
	reqClon.identificarClienteSap = () => _identificarClienteSap(reqClon);
	reqClon.identificarUsuarioAutenticado = () => _identificarUsuarioAutenticado(reqClon);
	return reqClon;

}


/**
 * Envuelve la ejecución del controlador en un try/catch para controlar cualquier excepcion no controlada
 * y al menos devolver algo al cliente.
 * @param {*} funcionControlador 
 * @returns 
 */
const tryCatch =  (funcionControlador) => {
	let controlador = async function (req, res) {
		let txId = req.txId;
		try {
			await funcionControlador(req, res);
		} catch (excepcion) {
			let errorFedicom = new ErrorFedicom(excepcion);
			L.xf(txId, ['Ocurrió un error al ejecutar la petición', errorFedicom])
			errorFedicom.enviarRespuestaDeError(res);
			L.dump(excepcion, req)
			return;
		}
	}
	return controlador;
}


module.exports = {
	extenderSolicitudHttp,
	extenderSolicitudRetransmision,
	tryCatch
}