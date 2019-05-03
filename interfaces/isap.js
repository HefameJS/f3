
const config = global.config;
const SapSystem = require('../model/sapsystem');
const Events = require('../interfaces/events');
const request = require('request');

exports.authenticate = function ( txId, authReq, callback ) {

  var sapSystem = new SapSystem(config.getDefaultSapSystem());
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

  Events.emitSapRequest(txId, url, httpCallParams);

  request(httpCallParams, function(err, res, body) {
    Events.emitSapResponse(txId, res, body, err);

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
        }, res, body)
    }

  });

}


exports.realizarPedido = function ( txId, pedido, callback ) {

	var sapSystem = new SapSystem(config.getDefaultSapSystem());
	var url = sapSystem.getURI('/api/zsd_ent_ped_api');

	var httpCallParams = {
		followAllRedirects: true,
		json: true,
		url: url,
		method: 'POST',
		headers: sapSystem.getAuthHeaders(),
		body: pedido,
		encoding: 'latin1'
	};

	Events.emitSapRequest(txId, url, httpCallParams);

	request(httpCallParams, function(err, res, body) {
		Events.emitSapResponse(txId, res, body, err);

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
