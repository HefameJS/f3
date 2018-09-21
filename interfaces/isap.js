
const config = global.config;
const SapSystem = require('../model/sapsystem');
const request = require('request');

exports.authenticate = function ( authReq, callback ) {

  var sapSystem = new SapSystem(config.getDefaultSapSystem());
  var url = sapSystem.getURI('/api/zverify_fedi_credentials');

  var httpCallParams = {
    followAllRedirects: true,
    json: true,
    url: url,
    method: 'POST',
    headers: sapSystem.getAuthHeaders(),
    body: authReq
  };

  request(httpCallParams, function(err, res, body) {
    if (err) {
      console.log(res);
      callback(err, res, body);
      return;
    }

    var statusCodeType = Math.floor(res.statusCode / 100);

    if (statusCodeType === 2) {
        callback(null, res, body);
    } else {
        console.log(res);
        callback({
          errno: res.statusCode,
          code: res.statusMessage
        }, res, body)
    }

  });

}
