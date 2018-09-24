

module.exports.registerAuthRequest = function (req) {
  var reqData = {
    id: req.txId,
    type: 'AUTH',
    status: 'PROCESANDO',
    clientRequest: {
      ip: req.ip,
      protocol: req.protocol,
      method: req.method,
      url: req.originalUrl,
      route: req.route.path,
      headers: req.headers,
      body: req.body
    }
  }
  console.log(reqData);
}
module.exports.registerAuthResponse = function (res, responseBody, status) {

  var resData = {
    id: res.txId,
    status: status || 'OK',
    clientResponse: {
        status: res.statusCode,
        headers: res.getHeaders(),
        body: responseBody
    }
  }

  console.log(resData);

}


module.exports.registrarDescarte = function (req, res, responseBody, error) {

  var data = {
    id: req.txId,
    type: 'DESCARTADO',
    status: 'DESCARTADO',
    clientRequest: {
      ip: req.ip,
      protocol: req.protocol,
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: (error ? error.body : req.body )
    },
    clientResponse: {
        status: res.statusCode,
        headers: res.getHeaders(),
        body: responseBody
    }
  }

  console.log(data);

}
