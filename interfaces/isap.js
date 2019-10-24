'use strict';
const BASE = global.BASE;
const config = global.config;
const L = global.logger;
const SapSystem = require(BASE + 'model/sapsystem');
const Events = require(BASE + 'interfaces/events');
const credentialsCache = require(BASE + 'interfaces/cache/fedicomCredentials');
const request = require('request');

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
