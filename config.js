'use strict';
const BASE = global.BASE;
const L = global.logger;

const err = require(BASE + 'model/static/exitCodes');

var configVerificator = {
	sapSystems: function(config) {
		if (!config.sap_systems) {
			console.error("No se ha definido el nodo de sistemas SAP (sap_systems)");
			process.exit(err.E_NO_SAP_SYSTEMS);
		}

		if (!config.sap_systems.default) {
			console.error("No se ha definido el sistema SAP por defecto (sap_systems.default)");
			process.exit(err.E_NO_DEFAULT_SAP_SYSTEM);
		}

		var defaultSapSys = config.sap_systems.default;

		if (!config.sap_systems[defaultSapSys]) {
			console.error("No se ha definido el sistema SAP por defecto [" + defaultSapSys + "]");
			process.exit(err.E_DEFAULT_SAP_SYSTEM_NO_EXISTS);
		}

		for (var sapSystem in config.sap_systems) {
			if (sapSystem === 'default') continue;
			if (!this.sapSystem(config.sap_systems[sapSystem])) {
				console.error("El sistema SAP definido como [" + sapSystem + "] es inválido");
				console.error(config.sap_systems[sapSystem]);
				process.exit(err.E_INVALID_SAP_SYSTEM);
			}

		}
	},
	sapSystem: function(sapSys) {
		return (sapSys.host && sapSys.port && sapSys.https !== undefined && sapSys.username && sapSys.password);
	},
	http: function(config) {
		if (!config.http) {
			console.error("No se ha definido el nodo HTTP (http)");
			process.exit(err.E_NO_HTTP_CONFIG);
		}
		if (!config.http.port) {
			console.error("No se ha definido el puerto para HTTP (http.port)");
			process.exit(err.E_NO_HTTP_PORT);
		}
	},
	https: function(config) {
		if (!config.https) {
			console.error("No se ha definido el nodo HTTPS (https)");
			process.exit(err.E_NO_HTTPS_CONFIG);
		}
		if (!config.https.port) {
			console.error("No se ha definido el puerto para HTTPS (https.port)");
			process.exit(err.E_NO_HTTPS_PORT);
		}
	},
	jwt: function(config) {
		if (!config.jwt) {
			console.error("No se ha definido el nodo JTW (jwt)");
			process.exit(err.E_NO_JWT_CONFIG);
		}
		if (!config.jwt.token_signing_key) {
			console.error("No se ha definido la clave de firma de tokens (jwt.token_signing_key)");
			process.exit(err.E_JWT_NO_SIGN_KEY);
		}
		if (!config.jwt.password_encryption_key) {
			console.error("No se ha definido la clave de cifrado de contraseñas (jwt.password_encryption_key)");
			process.exit(err.E_JWT_NO_ENC_KEY);
		}
	},
	mongodb: function(config) {
		if (!config.mongodb) {
			console.error("No se ha definido el nodo para MongoDB (mongodb)");
			process.exit(err.E_NO_MDB_CONFIG);
		}
		if (!config.mongodb.hosts) {
			console.error("No se ha definido la lista de hosts de MongoDB (mongodb.hosts)");
			process.exit(err.E_MDB_NO_HOSTS);
		}
		if (!config.mongodb.username) {
			console.error("No se ha definido el usuario para MongoDB (mongodb.username)");
			process.exit(err.E_MDB_NO_USER);
		}
		if (!config.mongodb.pwd) {
			console.error("No se ha definido la clave para el usuario de MongoDB (mongodb.pwd)");
			process.exit(err.E_MDB_NO_PASS);
		}
		if (!config.mongodb.database) {
			console.error("No se ha definido el nombre de la base de datos de MongoDB (mongodb.database)");
			process.exit(err.E_MDB_NO_DATABASE);
		}
	},
	sqlite: function(config) {
		if (!config.sqlite) {
			console.error("No se ha definido el nodo para SQLite (sqlite)");
			process.exit(err.E_NO_SQLITE_CONFIG);
		}
		if (!config.sqlite.db_path) {
			console.error("No se ha definido el path para la base de datos de SQLite (sqlite.db_path)");
			process.exit(err.E_SQLITE_NO_PATH);
		}
	},
	watchdog: function(config) {
		if (!config.watchdog) {
			console.error("No se encuentra definido el nodo WATCHDOG (watchdog)")
			process.exit(err.E_NO_WATCHDOG_CONFIG);
		}
		this.watchdog_http(config);
	},
	watchdog_http: function (config) {
		if (!config.watchdog.https) {
			console.error("No se ha definido el nodo WATCHDOG - HTTPS (watchdog.https)");
			process.exit(err.E_WATCHDOG_NO_HTTPS);
		}
		if (!config.watchdog.https.port) {
			console.error("No se ha definido el puerto para WATCHDOG - HTTPS (watchdog.https.port)");
			process.exit(err.E_WATCHDOG_NO_HTTPS_PORT);
		}
	}

};
var config = {};

var filepath = process.env.F3_CONFIG_FILE || './config.json';
try {
	console.log("Leyendo configuración del servicio del fichero [%s]", filepath);
	config = require(filepath);

	console.log("Leida configuracion");
	console.log(config);

	// Verificando la configuración mínima.
	// Los siguientes métodos detienen la ejecución en caso de fallo
	configVerificator.sapSystems(config);
	configVerificator.http(config);
	configVerificator.https(config);
	configVerificator.jwt(config);
	configVerificator.mongodb(config);
	configVerificator.sqlite(config);


} catch (exception) {
	console.error("**** NO SE ENCUENTRA EL FICHERO DE CONFIGURACIÓN O NO ES VÁLIDO");
	console.error(exception);
	process.exit(err.E_NO_CONFIG);
}


config.getDefaultSapSystem = function () {
	return this.sap_systems[this.sap_systems.default];
}

config.getSapSystem = function (sapsid) {
  if (sapsid && this.sap_systems[sapsid]) {
    return this.sap_systems[sapsid];
  }
  global.logger.e("No se encuentra el sistema SAP [" + sapsid + "]");
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

	var url =  'mongodb://' + username + ':' + password + '@' + servers + '/' + database ;
	if (replicaSet) url += '?replicaSet=' + replicaSet;
	return url;
}



module.exports = config;
