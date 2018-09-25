
const config = global.config;
const FedicomError = require('../model/FedicomError');

module.exports.encrypt = function (text) {
  var crypto = require('crypto');
  var cipher = crypto.createCipher('aes-256-ctr', config.jwt.password_encryption_key);
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

module.exports.decrypt = function(text) {
  var crypto = require('crypto');
  var decipher = crypto.createDecipher('aes-256-ctr', config.jwt.password_encryption_key);
  var dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}



module.exports.generateJWT = function(authReq, includePassword) {
  var jwt = require('jsonwebtoken');
  var jwtData = {
    // iss: 'HEFAME@' + require('os').hostname() + '.' + config.http.https_port,
    sub: authReq.username,
    exp: Date.timestamp() + (1000 * 60 * config.jwt.token_lifetime_minutes),
    iat: Date.timestamp()
  };

  if (includePassword) {
    jwtData.cyp = module.exports.encrypt(authReq.password);
  }

  return jwt.sign(jwtData, config.jwt.token_signing_key);
}


module.exports.verifyJWT = function(token) {

  if (!token) {
    return {
      meta: {
        ok: false,
        error: 'No se especifica token',
        exception: new FedicomError('AUTH-002', 'Token inválido', 401)
      }
    }
  }

  var jwt = require('jsonwebtoken');
  try {
    var decoded = jwt.verify(token, config.jwt.token_signing_key);
    var meta = {};

    if (decoded.exp) {
      var diff = Date.timestamp() - decoded.exp;
      if (diff > (config.jwt.token_validation_skew_clock_seconds * 1000) ) {
        // TOKEN CADUCADO
        meta = {
          ok: false,
          error: 'Token caducado',
          exception: new FedicomError('AUTH-001', 'Usuario no autentificado', 401)
        }

      } else {
        // TOKEN OK
        if (decoded.cyp) {
          meta = {
            ok: true,
            verified: false,
            pwd:  module.exports.decrypt(decoded.cyp)
          }
        } else {
          meta = {
            ok: true,
            verified: true
          }
        }

      }
    } else {
      // ¿No contiene campo 'exp'? ESTO ES UN FAKE
      meta = {
        ok: false,
        error: 'Token incompleto',
        exception: new FedicomError('AUTH-002', 'Token inválido', 401)
      }
    }
    decoded.meta = meta;
    return decoded;

  } catch(err) {
    return {
      meta: {
        ok: false,
        error: err.message,
        exception: new FedicomError('AUTH-002', 'Token inválido', 401)
      }
    };
  }

}
