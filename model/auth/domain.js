'use strict';

module.exports.domains = ['FEDICOM', 'APIKEY'];

module.exports.verify = function(domain) {
  if (domain) {
    var idx = module.exports.domains.indexOf(domain);
    if (idx > -1) {
      return module.exports.domains[idx];
    }
  }
  return module.exports.domains[0];
}
