'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;
const M = global.mongodb;

// Externas
const clone = require('clone');

const iTokens = require('global/tokens');
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
			usuario: req.body.user.trim?.(),
			dominio: req.body.domain?.trim?.() || C.dominios.nombreDominioPorDefecto
		}
	}

	return {
		usuario: null,
		dominio: null
	};
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

/**
 * Identifica el código del programa de farmacia que realiza la transmisión y lo devuelve normalizado.
 * @param {*} req 
 * @returns 
 */
const _identificarProgramaFarmacia = (req) => {
	if (req.headers?.['software-id'])
		return parseInt(req.headers?.['software-id']) || null;
	return null;
}

/**
 * Obtiene y normaliza la dirección IP origen de la transmisión
 * @param {*} req 
 */
const _obtenerDireccionIp = (req) => {
	let ip = req.ip;

	if (req.headers && req.headers['x-forwarded-for'])
		ip = req.headers['x-forwarded-for'];

	if (ip === '::1')
	 return '127.0.0.1'
	
	if (ip?.startsWith?.('::ffff:'))		
		return ip.slice(7, ip.length);

	return ip;
}

/**
 * Obtiene la configuración SSL de la conexión entrante
 * @param {*} req 
 * @returns 
 */
const _obtenerDatosSSL = (req) => {

	let tmp = {
		protocoloSSL: null,
		suiteSSL: null
	}

	if (req.headers?.['x-ssl-protocol']) tmp.protocoloSSL = req.headers['x-ssl-protocol'];
	if (req.headers?.['x-ssl-cipher']) tmp.suiteSSL = req.headers['x-ssl-cipher'];

	return tmp;
}

/**
 * Obtiene el nombre del balanceador de carga que recogió la petición, si existe.
 * @param {} req 
 * @returns 
 */
const _obtenerNombreBalanceador = (req) => {
	return req.headers?.['x-balanceador']?.toLowerCase?.() || null;
} 


const _obtenerDatosConcentrador = (req) => {
	return {
		servidor: K.HOSTNAME,
		pid: process.pid,
		version: K.VERSION.SERVIDOR,
		git: K.VERSION.GIT
	}
}
/**
 * Amplia los objetos de solicitud y respuesta HTTP de Express con utilidades que
 * necesitaremos durante el flujo.
 * 	- req.txId, res.txId -> Genera el ID único de transmisión
 * 	- Establece cabeceras de respuesta : X-TxID, Software-ID, Content-Api-Version
 * 	- req.identificarClienteSap -> Funcion que determina el código de cliente SAP del cuerpo del mensaje si existe.
 * 	- req.identificarUsuarioAutenticado -> Funcion que determina el código de cliente autenticado en el token, si existe.
 *  * 
 * @param {*} req 
 * @param {*} res 
 */
const extenderSolicitudHttp = (req, res) => {

	let txId = new M.ObjectID();
	req.txId = res.txId = txId;

	req.token = iTokens.verificarToken(req.token, txId);

	res.setHeader('X-TxID', txId);
	res.setHeader('Software-ID', C.softwareId.servidor);
	res.setHeader('Content-Api-Version', K.VERSION.PROTOCOLO);

	// Deben devolverse como funciones ya que aun no se han analizado los datos de la petición
	req.identificarClienteSap = () => _identificarClienteSap(req);
	req.identificarUsuarioAutenticado = () => _identificarUsuarioAutenticado(req);
	req.identificarProgramaFarmacia = () => _identificarProgramaFarmacia(req);
	req.obtenerDireccionIp = () => _obtenerDireccionIp(req);
	req.obtenerDatosSSL = () => _obtenerDatosSSL(req);
	req.obtenerNombreBalanceador = () => _obtenerNombreBalanceador(req);
	req.obtenerDatosConcentrador = () => _obtenerDatosConcentrador(req);

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
	reqClon.ip = 'RTX';
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
	reqClon.identificarProgramaFarmacia = () => _identificarProgramaFarmacia(reqClon);
	reqClon.obtenerDireccionIp = () => _obtenerDireccionIp(reqClon);
	reqClon.obtenerDatosSSL = () => _obtenerDatosSSL(reqClon);

	req.generaFlagsTransmision = () => {

		return {
			"transmision.ip": req.obtenerDireccionIp(),
			"transmision.autenticacion": req.identificarUsuarioAutenticado(),
			"transmision.programa": req.identificarProgramaFarmacia(),
			"transmision.ssl": req.obtenerDatosSSL()
		}

	}

	return reqClon;

}


/**
 * Envuelve la ejecución del controlador en un try/catch para controlar cualquier excepcion no controlada
 * y al menos devolver algo al cliente.
 * @param {*} funcionControlador 
 * @returns 
 */
const tryCatch = (funcionControlador) => {
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