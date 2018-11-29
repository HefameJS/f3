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

config.getMongoUrl = function (servers, username, password, database, replicaSet) {
	var mc = config.mongodb;
	servers = servers ? servers : mc.hosts;
	username = username ? username : mc.username;
	password = password ? password : mc.pwd;
	database = database ? database : mc.database;
	replicaSet = replicaSet ? replicaSet : mc.replicaset;

	var servers = servers.join(',');

	return 'mongodb://' + username + ':' + password + '@' + servers + '/' + database + '?replicaSet=' + replicaSet;

}



module.exports = config;
