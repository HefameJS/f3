'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;
const SapSystem = require(BASE + 'model/sapsystem');
const Events = require(BASE + 'interfaces/events');
const credentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');
const request = require('request');

exports.ping = function (sapSystem, callback) {
	var sapSystemData = sapSystem ? config.getSapSystem(sapSystem) : config.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', false);
		return;
	}

	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/api/zsd_ent_ped_api/pedidos/avalibity');

	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: url,
		method: 'GET',
		headers: sapSystem.getAuthHeaders(),
		encoding: 'latin1'
	};


	request(httpCallParams, function (err, res, body) {
		if (err) {
			callback(err, false);
			return;
		}

		var statusCodeType = Math.floor(res.statusCode / 100);
		if (statusCodeType === 2) {
			callback(null, true);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, false);
		}

	});
}

exports.authenticate = function ( txId, authReq, callback, noEvents) {

	var fromCache = credentialsCache.check(authReq);
	if (fromCache) {
		L.xd(txId, 'Se produjo un acierto de caché en la credencial de usuario.', 'credentialCache')
		callback(null, null, {username: authReq.username}, false);
		return;
	}

	var sapSystemData = authReq.sap_system ? config.getSapSystem(authReq.sap_system) : config.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/api/zverify_fedi_credentials');

  var httpCallParams = {
    followAllRedirects: true,
    json: true,
    url: url,
    method: 'POST',
    headers: sapSystem.getAuthHeaders(),
    body: authReq,
	 encoding: 'latin1'
  };

  Events.sap.emitSapRequest(txId, url, httpCallParams);

  request(httpCallParams, function(err, res, body) {
    Events.sap.emitSapResponse(txId, res, body, err);

    if (err) {
      callback(err, res, body, false);
      return;
    }

    var statusCodeType = Math.floor(res.statusCode / 100);

	 	if (statusCodeType === 2) {
			// Solo si SAP responde con el nombre del usuario guardamos la entrada en caché
			if (body.username && body.username.length > 0)
				credentialsCache.add(authReq);
			callback(null, res, body, false);
		} else {
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body, false)
		}

  });

}

exports.realizarPedido = function ( txId, pedido, callback ) {
	var sapSystemData = pedido.sap_system ? config.getSapSystem(pedido.sap_system) : config.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/api/zsd_ent_ped_api/pedidos');

	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: url,
		method: 'POST',
		headers: sapSystem.getAuthHeaders(),
		body: pedido,
		encoding: 'latin1'
	};

	Events.sap.emitSapRequest(txId, url, httpCallParams);

	request(httpCallParams, function(err, res, body) {
		Events.sap.emitSapResponse(txId, res, body, err);

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

exports.realizarDevolucion = function ( txId, devolucion, callback ) {
	var sapSystemData = devolucion.sap_system ? config.getSapSystem(devolucion.sap_system) : config.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/api/zsd_ent_ped_api/devoluciones');

	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: url,
		method: 'POST',
		headers: sapSystem.getAuthHeaders(),
		body: devolucion,
		encoding: 'latin1'
	};

	Events.sap.emitSapRequest(txId, url, httpCallParams);

	request(httpCallParams, function(err, res, body) {
		Events.sap.emitSapResponse(txId, res, body, err);

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

exports.retransmit = function ( txId, sapRequest, callback) {

	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: sapRequest.url,
		method: sapRequest.method,
		headers: sapSystem.getAuthHeaders(),
		body: sapRequest.body,
		encoding: 'latin1'
	};

	request(httpCallParams, function(err, res, body) {
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

exports.getAlbaranXML = function (txId, numeroAlbaran, codigoUsuario, callback) {

	var sapSystemData = config.getDefaultSapSystem();
	if (!sapSystemData) {
		callback('No se encuentra el sistema destino', null, null, true);
		return;
	}
	var sapSystem = new SapSystem(sapSystemData);
	var url = sapSystem.getURI('/sap/bc/srt/rfc/sap/zws_ytc_albaran_xml_hefame/020/zws_ytc_albaran_xml_hefame/zws_ytc_albaran_xml_hefame' );

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
			"Authorization": "Basic " + Buffer.from("RFC_SD:UNYCOP").toString("base64"),
			"Content-Type": "application/soap+xml"
		},
		encoding: 'latin1',
		body: body
	};

	L.xd(txId, ['Enviando a SAP consulta de albaránXML', httpCallParams]);

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

	var sapSystemData = config.getDefaultSapSystem();
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

	var sapSystemData = config.getDefaultSapSystem();
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
			callback({
				errno: res.statusCode,
				code: res.statusMessage
			}, res, body);
		}

	});
}