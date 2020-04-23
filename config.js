'use strict';
let C = {};
//const L = global.logger;
const K = global.constants;

const verificarSistemasSap = (config) => {
	if (!config.sap_systems) {
		console.error("No se ha definido el nodo de sistemas SAP (sap_systems)");
		process.exit(K.EXIT_CODES.E_NO_SAP_SYSTEMS);
	}

	if (!config.sap_systems.default) {
		console.error("No se ha definido el sistema SAP por defecto (sap_systems.default)");
		process.exit(K.EXIT_CODES.E_NO_DEFAULT_SAP_SYSTEM);
	}

	let defaultSapSys = config.sap_systems.default;

	if (!config.sap_systems[defaultSapSys]) {
		console.error("No se ha definido el sistema SAP por defecto [" + defaultSapSys + "]");
		process.exit(K.EXIT_CODES.E_DEFAULT_SAP_SYSTEM_NO_EXISTS);
	}

	for (let sapSystem in config.sap_systems) {
		if (sapSystem === 'default') continue;
		if (!verificarSistemaSap(config.sap_systems[sapSystem])) {
			console.error("El sistema SAP definido como [" + sapSystem + "] es inválido");
			console.error(config.sap_systems[sapSystem]);
			process.exit(K.EXIT_CODES.E_INVALID_SAP_SYSTEM);
		}

	}
};
const verificarSistemaSap = (sapSys) => {
	return (sapSys.host && sapSys.port && sapSys.https !== undefined && sapSys.username && sapSys.password);
};
const verificarHttp = (config) => {
	if (!config.http) {
		console.error("No se ha definido el nodo HTTP (http)");
		process.exit(K.EXIT_CODES.E_NO_HTTP_CONFIG);
	}
	if (!config.http.port) {
		console.error("No se ha definido el puerto para HTTP (http.port)");
		process.exit(K.EXIT_CODES.E_NO_HTTP_PORT);
	}
};
const verificarJWT = (config) => {
	if (!config.jwt) {
		console.error("No se ha definido el nodo JTW (jwt)");
		process.exit(K.EXIT_CODES.E_NO_JWT_CONFIG);
	}
	if (!config.jwt.token_signing_key) {
		console.error("No se ha definido la clave de firma de tokens (jwt.token_signing_key)");
		process.exit(K.EXIT_CODES.E_JWT_NO_SIGN_KEY);
	}
};
const verificarMongodb = (config) => {
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
};
const verificarSQLite = (config) => {
	if (!config.sqlite) {
		console.error("No se ha definido el nodo para SQLite (sqlite)");
		process.exit(K.EXIT_CODES.E_NO_SQLITE_CONFIG);
	}
	if (!config.sqlite.db_path) {
		console.error("No se ha definido el path para la base de datos de SQLite (sqlite.db_path)");
		process.exit(K.EXIT_CODES.E_SQLITE_NO_PATH);
	}
};
const verificarLdap = (config) => {
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
};
const verificarWatchdog = (config) => {
	if (!config.watchdog) {
		console.error("No se encuentra definido el nodo WATCHDOG (watchdog)")
		process.exit(K.EXIT_CODES.E_NO_WATCHDOG_CONFIG);
	}
};
const verificarMonitor = (config) => {
	if (!config.monitor) {
		console.error("No se encuentra definido el nodo MONITOR (monitor)")
		process.exit(K.EXIT_CODES.E_NO_MONITOR_CONFIG);
	}
	if (!config.monitor.http) {
		console.error("No se ha definido el nodo MONITOR - HTTP (monitor.http)");
		process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTP);
	}
	if (!config.monitor.http.port) {
		console.error("No se ha definido el puerto para MONITOR - HTTP (monitor.http.port)");
		process.exit(K.EXIT_CODES.E_MONITOR_NO_HTTP_PORT);
	}
};


const _verificadorConfiguracion = {
	verificarSistemasSap,
	verificarSistemaSap,
	verificarHttp,
	verificarJWT,
	verificarMongodb,
	verificarSQLite,
	verificarLdap,
	verificarWatchdog,
	verificarMonitor
};


const FICHERO_CONFIGURACION = process.env.F3_CONFIG_FILE || 'config.json';
try {
	C = require(FICHERO_CONFIGURACION);

	// Verificando la configuración mínima.
	// Los siguientes métodos detienen la ejecución en caso de fallo

	if (!(C.production === true || C.production === false)) {
		console.error("No se ha definido el nodo PRODUCTION (production) a TRUE o FALSE. Por motivos de seguridad, esto es obligatorio.");
		process.exit(K.EXIT_CODES.E_NO_PRODUCTION_DEFINED);
	}
	_verificadorConfiguracion.verificarSistemasSap(C);
	_verificadorConfiguracion.verificarHttp(C);
	_verificadorConfiguracion.verificarJWT(C);
	_verificadorConfiguracion.verificarMongodb(C);
	_verificadorConfiguracion.verificarSQLite(C);
	_verificadorConfiguracion.verificarLdap(C);


	// Configuracion para la instancia de watchdog
	if (process.type === K.PROCESS_TYPES.WATCHDOG) {
		_verificadorConfiguracion.verificarWatchdog(C);
	}


	// Configuracion para la instancia de monitor
	if (process.type === K.PROCESS_TYPES.MONITOR) {
		_verificadorConfiguracion.verificarMonitor(C);
	}


	C.ldap.tlsOptions = {
		ca: [require('fs').readFileSync(C.ldap.cacert)]
	};

} catch (excepcion) {
	console.error("**** NO SE ENCUENTRA EL FICHERO DE CONFIGURACIÓN O NO ES VÁLIDO");
	console.error(excepcion);
	process.exit(K.EXIT_CODES.E_NO_CONFIG);
}


C.sistemaSapPorDefecto = () => {
	return C.sap_systems[C.sap_systems.default];
}

C.sistemaSap = (sapsid) => {
	if (sapsid && C.sap_systems[sapsid]) {
		return C.sap_systems[sapsid];
	}
	global.logger.e("No se encuentra el sistema SAP [" + sapsid + "]");
	return null;
}

C.urlConexionMongo = (servidores, usuario, password, db, replicaSet) => {

	servidores = servidores ? servidores : C.mongodb.hosts;
	usuario = usuario ? usuario : C.mongodb.username;
	password = password ? password : C.mongodb.pwd;
	db = db ? db : C.mongodb.database;
	replicaSet = replicaSet ? replicaSet : C.mongodb.replicaset; 

	let url = 'mongodb://' + usuario + ':' + password + '@' + servidores.join(',') + '/' + db + '?replicaSet=' + replicaSet;
	return url;
}

module.exports = C;
