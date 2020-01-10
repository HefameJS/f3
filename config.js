'use strict';
const BASE = global.BASE;
var C = {};
//const L = global.logger;
const K = global.constants;

var configVerificator = {
	sapSystems: function (config) {
		if (!config.sap_systems) {
			console.error("No se ha definido el nodo de sistemas SAP (sap_systems)");
			process.exit(K.EXIT_CODES.E_NO_SAP_SYSTEMS);
		}

		if (!config.sap_systems.default) {
			console.error("No se ha definido el sistema SAP por defecto (sap_systems.default)");
			process.exit(K.EXIT_CODES.E_NO_DEFAULT_SAP_SYSTEM);
		}

		var defaultSapSys = config.sap_systems.default;

		if (!config.sap_systems[defaultSapSys]) {
			console.error("No se ha definido el sistema SAP por defecto [" + defaultSapSys + "]");
			process.exit(K.EXIT_CODES.E_DEFAULT_SAP_SYSTEM_NO_EXISTS);
		}

		for (var sapSystem in config.sap_systems) {
			if (sapSystem === 'default') continue;
			if (!this.sapSystem(config.sap_systems[sapSystem])) {
				console.error("El sistema SAP definido como [" + sapSystem + "] es inválido");
				console.error(config.sap_systems[sapSystem]);
				process.exit(K.EXIT_CODES.E_INVALID_SAP_SYSTEM);
			}

		}
	},
	sapSystem: function (sapSys) {
		return (sapSys.host && sapSys.port && sapSys.https !== undefined && sapSys.username && sapSys.password);
	},
	http: function (config) {
		if (!config.http) {
			console.error("No se ha definido el nodo HTTP (http)");
			process.exit(K.EXIT_CODES.E_NO_HTTP_CONFIG);
		}
		if (!config.http.port) {
			console.error("No se ha definido el puerto para HTTP (http.port)");
			process.exit(K.EXIT_CODES.E_NO_HTTP_PORT);
		}
	},
	https: function (config) {
		if (!config.https) {
			console.error("No se ha definido el nodo HTTPS (https)");
			process.exit(K.EXIT_CODES.E_NO_HTTPS_CONFIG);
		}
		if (!config.https.port) {
			console.error("No se ha definido el puerto para HTTPS (https.port)");
			process.exit(K.EXIT_CODES.E_NO_HTTPS_PORT);
		}
		if (!config.https.cert) {
			console.error("No se ha definido el certificado para HTTPS (https.cert)");
			process.exit(K.EXIT_CODES.E_NO_HTTPS_CERT);
		}
		if (!config.https.key) {
			console.error("No se ha definido la clave privada para HTTPS (https.key)");
			process.exit(K.EXIT_CODES.E_NO_HTTPS_KEY);
		}
		if (!config.https.passphrase && config.https.passphrase !== '') {
			console.error("No se ha definido la passphrase para HTTPS (https.passphrase)");
			process.exit(K.EXIT_CODES.E_NO_HTTPS_PASSPHRASE);
		}
	},
	jwt: function (config) {
		if (!config.jwt) {
			console.error("No se ha definido el nodo JTW (jwt)");
			process.exit(K.EXIT_CODES.E_NO_JWT_CONFIG);
		}
		if (!config.jwt.token_signing_key) {
			console.error("No se ha definido la clave de firma de tokens (jwt.token_signing_key)");
			process.exit(K.EXIT_CODES.E_JWT_NO_SIGN_KEY);
		}
	},
	mongodb: function (config) {
		if (!config.mongodb) {
			console.error("No se ha definido el nodo para MongoDB (mongodb)");
			process.exit(K.EXIT_CODES.E_NO_MDB_CONFIG);
		}
		if (!config.mongodb.hosts) {
			console.error("No se ha definido la lista de hosts de MongoDB (mongodb.hosts)");
			process.exit(K.EXIT_CODES.E_MDB_NO_HOSTS);
		}
		if (!config.mongodb.username) {
			console.error("No se ha definido el usuario para MongoDB (mongodb.username)");
			process.exit(K.EXIT_CODES.E_MDB_NO_USER);
		}
		if (!config.mongodb.pwd) {
			console.error("No se ha definido la clave para el usuario de MongoDB (mongodb.pwd)");
			process.exit(K.EXIT_CODES.E_MDB_NO_PASS);
		}
		if (!config.mongodb.database) {
			console.error("No se ha definido el nombre de la base de datos de MongoDB (mongodb.database)");
			process.exit(K.EXIT_CODES.E_MDB_NO_DATABASE);
		}
		if (!config.mongodb.txCollection) {
			console.error("No se ha definido el nombre de la coleccion de transmisiones de MongoDB (mongodb.txCollection)");
			process.exit(K.EXIT_CODES.E_MDB_NO_TXCOL);
		}
		if (!config.mongodb.discardCollection) {
			console.error("No se ha definido el nombre de la coleccion de transmisiones descartadas de MongoDB (mongodb.discardCollection)");
			process.exit(K.EXIT_CODES.E_MDB_NO_DISCARDCOL);
		}
		if (!config.mongodb.logCollection) {
			console.error("No se ha definido el nombre de la coleccion de log de MongoDB (mongodb.logCollection)");
			process.exit(K.EXIT_CODES.E_MDB_NO_LOGCOL);
		}
	},
	sqlite: function (config) {
		if (!config.sqlite) {
			console.error("No se ha definido el nodo para SQLite (sqlite)");
			process.exit(K.EXIT_CODES.E_NO_SQLITE_CONFIG);
		}
		if (!config.sqlite.db_path) {
			console.error("No se ha definido el path para la base de datos de SQLite (sqlite.db_path)");
			process.exit(K.EXIT_CODES.E_SQLITE_NO_PATH);
		}
	},
	ldap: function (config) {
		if (!config.ldap) {
			console.error("No se ha definido el nodo para LDAP (ldap)");
			process.exit(K.EXIT_CODES.E_NO_LDAP_CONFIG);
		}
		if (!config.ldap.url) {
			console.error("No se ha definido la url del servidor LDAP (ldap.url)");
			process.exit(K.EXIT_CODES.E_NO_LDAP_URL);
		}
		if (!config.ldap.cacert) {
			console.error("No se ha definido el certificado de CA para el servidor LDAP (ldap.cacert)");
			process.exit(K.EXIT_CODES.E_NO_LDAP_CA);
		}
	},
	watchdog: function (config) {
		if (!config.watchdog) {
			console.error("No se encuentra definido el nodo WATCHDOG (watchdog)")
			process.exit(K.EXIT_CODES.E_NO_WATCHDOG_CONFIG);
		}
		this.watchdog_http(config);
	},
	watchdog_http: function (config) {
		if (!config.watchdog.https) {
			console.error("No se ha definido el nodo WATCHDOG - HTTPS (watchdog.https)");
			process.exit(K.EXIT_CODES.E_WATCHDOG_NO_HTTPS);
		}
		if (!config.watchdog.https.port) {
			console.error("No se ha definido el puerto para WATCHDOG - HTTPS (watchdog.https.port)");
			process.exit(K.EXIT_CODES.E_WATCHDOG_NO_HTTPS_PORT);
		}
		if (!config.watchdog.https.cert) {
			console.error("No se ha definido el certificado para WATCHDOG - HTTPS (watchdog.https.cert)");
			process.exit(K.EXIT_CODES.E_WATCHDOG_NO_HTTPS_CERT);
		}
		if (!config.watchdog.https.key) {
			console.error("No se ha definido la clave privada para WATCHDOG - HTTPS (watchdog.https.key)");
			process.exit(K.EXIT_CODES.E_WATCHDOG_NO_HTTPS_KEY);
		}
		if (!config.watchdog.https.passphrase && config.watchdog.https.passphrase !== '') {
			console.error("No se ha definido la passphrase para WATCHDOG - HTTPS (watchdog.https.passphrase)");
			process.exit(K.EXIT_CODES.E_WATCHDOG_NO_HTTPS_PASSPHRASE);
		}
	},
	monitor: function (config) {
		if (!config.monitor) {
			console.error("No se encuentra definido el nodo MONITOR (monitor)")
			process.exit(K.EXIT_CODES.E_NO_MONITOR_CONFIG);
		}
		this.monitor_https(config);
	},
	monitor_https: function (config) {
		if (!config.monitor.https) {
			console.error("No se ha definido el nodo MONITOR - HTTPS (monitor.https)");
			process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTPS);
		}
		if (!config.monitor.https.port) {
			console.error("No se ha definido el puerto para MONITOR - HTTPS (monitor.https.port)");
			process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTPS_PORT);
		}
		if (!config.monitor.https.cert) {
			console.error("No se ha definido el certificado para MONITOR - HTTPS (monitor.https.cert)");
			process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTPS_CERT);
		}
		if (!config.monitor.https.key) {
			console.error("No se ha definido la clave privada para MONITOR - HTTPS (monitor.https.key)");
			process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTPS_KEY);
		}
		if (!config.monitor.https.passphrase && config.monitor.https.passphrase !== '') {
			console.error("No se ha definido la passphrase para MONITOR - HTTPS (monitor.https.passphrase)");
			process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTPS_PASSPHRASE);
		}
	}
};


var filepath = process.env.F3_CONFIG_FILE || BASE + 'config.json';
try {
	C = require(filepath);

	// Verificando la configuración mínima.
	// Los siguientes métodos detienen la ejecución en caso de fallo
	configVerificator.sapSystems(C);
	configVerificator.http(C);
	configVerificator.https(C);
	configVerificator.jwt(C);
	configVerificator.mongodb(C);
	configVerificator.sqlite(C);
	configVerificator.ldap(C);

	// Configuracion para la instancia de watchdog
	if (process.title === K.PROCESS_TITLES.WATCHDOG) {
		configVerificator.watchdog(C);
	}


	C.ldap.tlsOptions = {
		ca: [require('fs').readFileSync(C.ldap.cacert)]
	};

} catch (exception) {
	console.error("**** NO SE ENCUENTRA EL FICHERO DE CONFIGURACIÓN O NO ES VÁLIDO");
	console.error(exception);
	process.exit(K.EXIT_CODES.E_NO_CONFIG);
}


C.getDefaultSapSystem = () => {
	return C.sap_systems[C.sap_systems.default];
}

C.getSapSystem = (sapsid) => {
	if (sapsid && C.sap_systems[sapsid]) {
		return C.sap_systems[sapsid];
	}
	global.logger.e("No se encuentra el sistema SAP [" + sapsid + "]");
	return null;
}

C.getMongoUrl = (servers, username, password, database, replicaSet) => {
	var mc = C.mongodb;
	servers = servers ? servers : mc.hosts;
	username = username ? username : mc.username;
	password = password ? password : mc.pwd;
	database = database ? database : mc.database;
	replicaSet = replicaSet ? replicaSet : mc.replicaset;

	var servers = servers.join(',');

	var url = 'mongodb://' + username + ':' + password + '@' + servers + '/' + database;
	return url;
}

C.getMongoLogUrl = (servers, username, password, database, replicaSet) => {
	var mc = C.mongodb;
	servers = servers ? servers : mc.hosts;
	username = username ? username : mc.username;
	password = password ? password : mc.pwd;
	database = database ? database : mc.database;
	replicaSet = replicaSet ? replicaSet : mc.replicaset;

	var servers = servers.join(',');

	var url = 'mongodb://' + username + ':' + password + '@' + servers + '/' + database;
	return url;
}


module.exports = C;
