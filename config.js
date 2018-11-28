'use strict';


var filepath = process.env.F3_CONFIG_FILE || './config.json';
var config = require(filepath);


config.getDefaultSapSystem = function () {
  if (config && config.sap_systems && config.sap_systems.default) {
    var json = config.sap_systems[config.sap_systems.default];
    return json;
  }
  console.log("No se encuentra el sistema SAP por defecto");
  return null;
}


config.getSapSystem = function (sapsid) {
  if (config && config.sap_systems && sapsid) {
    var json = config.sap_systems[sapsid];
    return json;
  }
  console.log("No se encuentra el sistema SAP [" + sapsid + "]");
  return null;
}

config.getMongoUrl = function () {
	var mc = config.mongodb;

	var servers = mc.hosts.join(',');

	var mdb = 'mongodb://' + mc.username + ':' + mc.pwd + '@' + servers + '/' + mc.database + '?replicaSet=' + mc.replicaset;
	console.log('Conectandor a ' + mdb);
	return mdb;

}



module.exports = config;
