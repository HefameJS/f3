'use strict';

module.exports.domains = {
  fedicom: 'FEDICOM',
  transfer: 'transfer_laboratorio',
  apikey: 'APIKEY'
};

module.exports.verify = function(domain) {
    if (domain) {
      for (var domainIdx in module.exports.domains) {
        if (module.exports.domains[domainIdx].toUpperCase() === domain.toUpperCase())
          return module.exports.domains[domainIdx];
      }
    }
    return module.exports.domains.fedicom;
  }