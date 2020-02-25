'use strict';
const BASE = global.BASE;
const C = global.config;
const L = global.logger;
const K = global.constants;

const SapSystem = require(BASE + 'model/sapsystem');
const Events = require(BASE + 'interfaces/events');
const credentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');
const request = require('request');

// migracion
const config = C;

/**
 * Trata de crear el objeto del sistema SAP en base al nombre del mismo.
 * Si no se especifica el nombre, se usa el sistema SAP por defecto.
 * En caso de que el sistema SAP no exista, se devuelve null.
 * Si el sistema SAP es correcto, se devuelve el objeto SapSystem
 * 
 * @param {*} sapSystemName 
 * @param {*} callback 
 */
const getSapSystem = (sapSystemName) => {
	var sapSystemData = sapSystemName ? C.getSapSystem(sapSystemName) : C.getDefaultSapSystem();
	if (!sapSystemData) {
		return null;
	}
	return new SapSystem(sapSystemData);
}

const ampliaSapResponse = (sapResponse, sapBody) => {
	if (!sapResponse) sapResponse = {};
	sapResponse.body = sapBody;
	sapResponse.errorSap = Math.floor(sapResponse.statusCode / 100) !== 2;
	return sapResponse;
}

const NO_SAP_SYSTEM_ERROR = {
	type: K.ISAP.ERROR_TYPE_NO_SAPSYSTEM,
	errno: null,
	code: 'No se encuentra definido el sistema SAP destino'
}


exports.ping = (sapSystem, callback) => {
	var sapSystem = getSapSystem(sapSystem);
	if (!sapSystem) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	var httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsd_ent_ped_api/pedidos/avalibity'
	});


	request(httpCallParams, function (callError, sapResponse, sapBody) {

		sapResponse = ampliaSapResponse(sapResponse, sapBody);
		if (callError) {
			callError.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(callError, false);
			return;
		}

		if (sapResponse.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: sapResponse.statusCode,
				code: sapResponse.statusMessage
			}, false);
			return;
		}

		callback(null, true, sapSystem);

	});
}

exports.authenticate = (txId, authReq, callback) => {

	if (!authReq.noCache) {
		var fromCache = credentialsCache.check(authReq);
		if (fromCache) {
			L.xd(txId, 'Se produjo un acierto de caché en la credencial de usuario.', 'credentialCache');
			callback(null, { body: { username: authReq.username } });
			return;
		}
	}

	var sapSystem = getSapSystem(authReq.sapSystem);
	if (!sapSystem) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	var httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zverify_fedi_credentials',
		body: authReq
	});

	Events.sap.emitRequestToSap(txId, httpCallParams);

	request(httpCallParams, (callError, sapResponse, sapBody) => {

		sapResponse = ampliaSapResponse(sapResponse, sapBody);
		Events.sap.emitResponseFromSap(txId, callError, sapResponse);

		if (callError) {
			callError.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(callError, sapResponse);
			return;
		}

		if (sapResponse.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: sapResponse.statusCode,
				code: sapResponse.statusMessage
			}, sapResponse)
			return;
		}

		// Solo si SAP responde con el nombre del usuario guardamos la entrada en caché
		if (!authReq.noCache && sapBody.username && sapBody.username.length > 0) {
			credentialsCache.add(authReq);
		}

		callback(null, sapResponse);


	});

}

exports.realizarPedido = (txId, pedido, callback) => {

	var sapSystem = getSapSystem(pedido.sapSystem);
	if (!sapSystem) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	var httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsd_ent_ped_api/pedidos',
		body: pedido
	});

	Events.sap.emitRequestToSap(txId, httpCallParams);
	request(httpCallParams, (callError, sapResponse, sapBody) => {
		sapResponse = ampliaSapResponse(sapResponse, sapBody);
		Events.sap.emitResponseFromSap(txId, callError, sapResponse);

		if (callError) {
			callError.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(callError, sapResponse);
			return;
		}

		if (sapResponse.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: sapResponse.statusCode,
				code: sapResponse.statusMessage
			}, sapResponse)
			return;
		}

		callback(null, sapResponse);

	});
}

exports.realizarDevolucion = (txId, devolucion, callback) => {
	var sapSystem = getSapSystem(devolucion.sapSystem);
	if (!sapSystem) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}


	var httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsd_ent_ped_api/devoluciones',
		body: devolucion
	});

	Events.sap.emitRequestToSap(txId, httpCallParams);
	request(httpCallParams, (callError, sapResponse, sapBody) => {
		sapResponse = ampliaSapResponse(sapResponse, sapBody);
		Events.sap.emitResponseFromSap(txId, callError, sapResponse);

		if (callError) {
			callError.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(callError, sapResponse);
			return;
		}

		if (sapResponse.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: sapResponse.statusCode,
				code: sapResponse.statusMessage
			}, sapResponse)
			return;
		}

		callback(null, sapResponse);
	});
}

exports.retransmitirPedido = (pedido, callback) => {

	var sapSystem = getSapSystem(pedido.sapSystem);
	if (!sapSystem) {
		callback(NO_SAP_SYSTEM_ERROR, null);
		return;
	}

	var httpCallParams = sapSystem.getRequestCallParams({
		path: '/api/zsd_ent_ped_api/pedidos',
		body: pedido
	});

	var sapRequest = {
		timestamp: new Date(),
		method: httpCallParams.method,
		headers: httpCallParams.headers,
		body: httpCallParams.body,
		url: httpCallParams.url
	}

	request(httpCallParams, function (callError, sapResponse, sapBody) {
		sapResponse = ampliaSapResponse(sapResponse, sapBody);

		if (callError) {
			callError.type = K.ISAP.ERROR_TYPE_SAP_UNREACHABLE;
			callback(callError, sapResponse, sapRequest);
			return;
		}

		if (sapResponse.errorSap) {
			callback({
				type: K.ISAP.ERROR_TYPE_SAP_HTTP_ERROR,
				errno: sapResponse.statusCode,
				code: sapResponse.statusMessage
			}, sapResponse, sapRequest);
		}
		callback(null, sapResponse, sapRequest);
	});

}

exports.getAlbaranXML = function (txId, numeroAlbaran, codigoUsuario, callback) {

	var sapSystemData = C.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/sap/bc/srt/rfc/sap/zws_ytc_albaran_xml_hefame/020/zws_ytc_albaran_xml_hefame/zws_ytc_albaran_xml_hefame');

	var body = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:urn="urn:sap-com:document:sap:rfc:functions"> \
		<soap:Header/>	 \
		<soap:Body> \
			<urn:YTC_ALBARAN_XML_HEFAME> \
				<I_ALBARAN>' + numeroAlbaran + '</I_ALBARAN> \
				<I_FECHA_D></I_FECHA_D> \
				<I_FECHA_H></I_FECHA_H> \
				<I_PDF> </I_PDF> \
				<I_USUARIO>' + codigoUsuario + '</I_USUARIO> \
				<TO_EDATA><item></item></TO_EDATA> \
			</urn:YTC_ALBARAN_XML_HEFAME> \
   		</soap:Body> \
	</soap:Envelope>';

	var httpCallParams = {
		followAllRedirects: true,
		url: url,
		method: 'POST',
		headers: {
			"Authorization": "Basic " + Buffer.from("RFC_ALBARXML:Hefame19").toString("base64"),
			"Content-Type": "application/soap+xml"
		},
		encoding: 'latin1',
		body: body
	};

	L.xd(txId, ['Enviando a SAP consulta de albaránXML']);

	request(httpCallParams, function (err, res, body) {

		if (err) {
			callback(err, res, body);
			return;
		}

		var statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, res, body);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body);
		}

	});
}

exports.getAlbaranPDF = function (txId, numeroAlbaran, callback) {

	var sapSystemData = C.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/api/zsf_get_document/proforma/' + numeroAlbaran);

	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: url,
		method: 'GET',
		headers: {
			'Accept-Encoding': 'application/json',
			'Content-Type': 'application/json',
			'x-hash': 'MD5',
			'x-key': '57980a6cef7a82dc8bed7dd617afac38',
			'x-salt': '123',
			'x-user': 'salesforce'
		},
		encoding: 'latin1'
	};

	L.xd(txId, ['Enviando a SAP consulta de albarán PDF', httpCallParams]);

	request(httpCallParams, function (err, res, body) {

		if (err) {
			callback(err, res, body);
			return;
		}

		var statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, res, body);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body);
		}

	});
}

exports.findAlbaranes = function (txId, query, callback) {

	var sapSystemData = C.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/api/zsf_get_order_list/find');


	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: url,
		method: 'GET',
		qs: query,
		headers: {
			'Accept-Encoding': 'application/json',
			'Content-Type': 'application/json',
			'x-hash': 'MD5',
			'x-key': '57980a6cef7a82dc8bed7dd617afac38',
			'x-salt': '123',
			'x-user': 'salesforce'
		},
		encoding: 'latin1'
	};

	request(httpCallParams, function (err, res, body) {

		if (err) {
			callback(err, res, body);
			return;
		}

		var statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, res, body);
		} else {
			// SAP puede dar un falso error si no se encuentran albaranes
			if (res.statusCode === 404 && res.statusMessage === 'No se han encontrado datos') {
				callback(null, res, []);
			}
			else {
				callback({
					errno: res.statusCode,
					code: res.statusMessage
				}, res, body);
			}
		}

	});
}