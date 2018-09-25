
module.exports.emitPedRequest = function (req) {
  var reqData = {
    id: req.txId,
    type: 'PEDIDO',
    status: 'RECEIVED',
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

module.exports.emitPedResponse = function (res, responseBody, status) {
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

module.exports.emitAuthRequest = function (req) {
  var reqData = {
    id: req.txId,
    type: 'AUTH',
    status: 'RECEIVED',
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

module.exports.emitAuthResponse = function (res, responseBody, status) {
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

module.exports.emitSapRequest = function (txId, req) {
    var data = {
      id: txId,
      status: 'SENT_TO_SAP',
      sapRequest: {
        method: req.method,
        headers: req.headers,
        body: req.body
      }
    }
    console.log(data);
}

module.exports.emitSapResponse = function (txId, res, body, error) {
  var statusCodeType = ( (res && res.statusCode) ? Math.floor(res.statusCode / 100) : 0);
  var sapResponse;

  if (error) {
    sapResponse = {
      error: {
        source: 'NET',
        statusCode: error.errno || 'UNDEFINED',
        message: error.message
      }
    }
  } else if (statusCodeType !== 2) {
    sapResponse = {
      error: {
        source: 'SAP',
        statusCode: res.statusCode,
        message: res.statusMessage
      }
    }
  } else {
    sapResponse = {
      statusCode: res.statusCode,
      headers: res.headers,
      body: body
    }
  }

  var data = {
    id: txId,
    status: 'BACK_FROM_SAP',
    sapResponse: sapResponse
  }

  console.log(data);
}

module.exports.emitDiscard = function (req, res, responseBody, error) {

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
      body: ( error ? error.body : req.body )
    },
    clientResponse: {
        status: res.statusCode,
        headers: res.getHeaders(),
        body: responseBody
    }
  }

  console.log(data);
}
