'use strict';
let C = {};
const L = require('./logger');
//const K = global.constants;
let M = global.mongodb;

// externas
const fs = require('fs');

// modelos
const DestinoSap = require('modelos/DestinoSap');

// util
const Validador = require('global/validador');



class Configuracion {
	constructor(ficheroConfiguracion) {
		let config;
		try {
			config = require(ficheroConfiguracion);
		} catch (excepcion) {
			console.error("No se encuentra el fichero de configuración", ficheroConfiguracion);
			console.error(excepcion);
			process.exit(1);
		}

		if (!(config.produccion === true || config.produccion === false))
			throw new Error("No se ha definido el nodo PRODUCTION (produccion) a TRUE o FALSE. Por motivos de seguridad, esto es obligatorio.");

		this.produccion = Boolean(config.produccion);
		this.numeroWorkers = Validador.esEnteroPositivoMayorQueCero(config.numeroWorkers) ? parseInt(config.numeroWorkers) : 1;

		// Objetos complejos
		this.mongodb = new ConfiguracionMongodb(config.mongodb);
		this.pid = new ConfiguracionPid(config.pid);
		this.log = new ConfiguracionLog(config.log);
		this.sqlite = new ConfiguracionSqlite(config.sqlite);
		this.http = new ConfiguracionHttp(config.http);

	}

	async cargarDatosCluster() {
		M = global.mongodb;
		this.jwt = await ConfiguracionJwt.cargar();
		this.sap = await ConfiguracionSap.cargar();
		this.dominios = await ConfiguracionDominios.cargar();
		this.flags = await ConfiguracionFlags.cargar();
		this.ldap = await ConfiguracionLdap.cargar();
	}

	static async cargarObjetoCluster(claveObjeto) {

		L.d(['Leyendo configuracion del clúster', claveObjeto]);

		let config = null;

		if (M.conectado) {
			try {
				config = await M.col.configuracion.findOne({ _id: claveObjeto });
				L.i(['Obtenida configuración del clúster', claveObjeto], 'config');
			} catch (errorMongo) {
				L.e(['Ocurrió un error en la consulta. Usamos configuración en caché', errorMongo])
			}
		}
		else {
			L.e(['No hay conexión con el clúster. Usamos configuración en caché'])
		}
		if (!config) {
			//TODO: Cargar configuración de caché
		} else {
			//TODO: Guardar configuración en caché
		}

		return config;
	}

}

class ConfiguracionMongodb {
	constructor(config) {
		if (!config) throw new Error("No se ha definido el nodo para MongoDB (mongodb)");
		if (!Validador.esArrayNoVacio(config.servidores)) throw new Error("No se ha definido la lista de servidores de MongoDB (mongodb.servidores)");
		if (!Validador.esCadenaNoVacia(config.usuario)) throw new Error("No se ha definido el usuario para MongoDB (mongodb.usuario)");
		if (!Validador.esCadenaNoVacia(config.password)) throw new Error("No se ha definido la password para el usuario de MongoDB (mongodb.password)");
		if (!Validador.esCadenaNoVacia(config.database)) throw new Error("No se ha definido el nombre de la base de datos de MongoDB (mongodb.database)");

		// Verificación de los servidores
		this.servidores = config.servidores
			.filter(servidor => Validador.esCadenaNoVacia(servidor))
			.map(servidor => servidor.trim());

		if (!Validador.esArrayNoVacio(config.servidores)) throw new Error("No hay ningún servidor MongoDB válido en la lista de servidores (mongodb.servidores)");

		this.usuario = config.usuario.trim();
		this.password = config.password;
		this.database = config.database.trim();

		if (Validador.esCadenaNoVacia(config.replicaSet)) {
			this.replicaSet = config.replicaSet.trim();
		}

		this.intervaloReconexion = Validador.esEnteroPositivoMayorQueCero(config.intervaloReconexion) ? parseInt(config.intervaloReconexion) : 5000;


		this.writeConcern = (config.writeConcern === 0 || config.writeConcern === 1) ? config.writeConcern : 1;


		/*
			connectTimeoutMS: 5000,
			serverSelectionTimeoutMS: 5000,
			w: C.mongodb.writeconcern || 1,
			wtimeout: 1000,
			useUnifiedTopology: true,
			appname: global.instanceID,
			loggerLevel: 'warn'
		*/
	}


	getUrl() {
		let url = 'mongodb://' +
			this.usuario + ':' + this.password +
			'@' + this.servidores.join(',') +
			'/' + this.database + '?';

		if (this.replicaSet) url += '&replicaSet=' + this.replicaSet;
		return url;
	}

	getConfigConexion() {
		return {
			connectTimeoutMS: 5000,
			serverSelectionTimeoutMS: 5000,
			w: this.writeConcern,
			wtimeout: 1000,
			useUnifiedTopology: true,
			appname: global.instanceID,
			loggerLevel: 'warn'
		};
	}
	//TODO: asdasdasd
}

class ConfiguracionLog {
	constructor(config) {
		this.consola = Boolean(config?.consola);
		this.directorio = config?.directorio ?? '~/log';
	}
}

class ConfiguracionPid {
	constructor(config) {
		this.directorio = config?.directorio ?? '~';
	}

	getFicheroPid() {
		return this.directorio + '/' + process.titulo + '.pid';
	}

	escribirFicheroPid() {
		fs.writeFile(this.getFicheroPid(), '' + process.pid, (errorFicheroPid) => {
			if (errorFicheroPid) {
				L.e(["Error al escribir el fichero del PID", errorFicheroPid]);
			}
		});
	}

	borrarFicheroPid() {
		fs.unlink(this.getFicheroPid(), () => { });
	}
}

class ConfiguracionSqlite {
	constructor(config) {
		this.fichero = config?.fichero ?? '~/db/db.sqlite';
	}
}

class ConfiguracionHttp {

	constructor(config) {
		this.puertoConcentrador = parseInt(config?.puertoConcentrador) || 5000;
		this.puertoConsultas = parseInt(config?.puertoConsultas) || 5001;
	}

}

class ConfiguracionJwt {

	constructor(config) {
		this.clave = config.clave;
		this.ttl = parseInt(config.ttl) || 3600;
		this.tiempoDeGracia = parseInt(config.tiempoDeGracia) || 60;
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('jwt');
		return new ConfiguracionJwt(config);
	}

}

class ConfiguracionSap {

	constructor(config) {

		this.nombreSistemaPorDefecto = config.sistemaPorDefecto;
		this.destinos = []
		config.destinos.forEach(destinoSap => {
			this.destinos.push(new DestinoSap(destinoSap))
		});

		this.destinoPorDefecto = this.destinos.find(destino => {
			return destino.id === this.nombreSistemaPorDefecto
		})

	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('sap');
		return new ConfiguracionSap(config);
	}

	getSistemaPorDefecto() {
		return this.destinoPorDefecto;
	}

	getSistema(sapsid) {
		if (!sapsid) return this.destinoPorDefecto;
		return this.destinos.find(destino => {
			return destino.id === sapsid
		})
	}
	

}

class ConfiguracionDominios {

	constructor(config) {

		
		if (!config) throw new Error("No se ha definido la configuracion de dominios de autenticacion ($.dominios)");
		if (!config.dominios) throw new Error("No se ha definido la configuracion de dominios de autenticacion ($.dominios.dominios)");
		if (!Object.keys(config.dominios).length) throw new Error("La lista de dominios de autenticacion está vacía ($.dominios.dominios)");

		Object.assign(this, config.dominios)

		

		this.nombreDominioPorDefecto = config.dominioPorDefecto || Object.keys(config.dominios)[0];
		this.principal = this[this.nombreDominioPorDefecto];

		if (!this.principal) throw new Error("No existe el dominio por defecto ($.dominios.dominios)");

	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('dominios');
		return new ConfiguracionDominios(config);
	}

	/**
	 * Obtiene el valor del dominio con el ID especificado, o null si no existe
	 */
	getDominio(id) {
		return this[id];
	}

	/**
	 * Obtiene el valor del dominio por defecto
	 */
	getPrincipal() {
		return this.principal;
	}

	/**
	 * Resuelve el ID del dominio y en caso de no existir devuelve el dominio
	 * por defecto.
	 */
	resolver(id) {
		return this.getDominio(id) || this.getPrincipal()
	}

}

class ConfiguracionFlags {

	constructor(config) {
		if (!config) throw new Error("No se ha definido la configuracion de flags ($.flags)");
		if (!config.flags) throw new Error("No se ha definido la configuracion de flags ($.flags.flags)");
		if (!Object.keys(config.flags).length) throw new Error("La lista de flags está vacía ($.flags.flags)");
		Object.assign(this, config.flags);
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('flags');
		return new ConfiguracionFlags(config);
	}

}

class ConfiguracionLdap {

/**C.ldap.tlsOptions = {
		ca: [require('fs').readFileSync(C.ldap.cacert)]
	}; */

	constructor(config) {

		if (!config) throw new Error("No se ha definido la configuracion de LDAP ($.ldap)");
		if (!Validador.esCadenaNoVacia(config.servidor)) throw new Error("No se ha definido el servidor LDAP ($.ldap.servidor)");
		if (!Validador.esCadenaNoVacia(config.baseBusqueda)) throw new Error("No se ha definido la base de búsqueda LDAP ($.ldap.baseBusqueda)");
		 

		this.servidor = config.servidor.trim();
		this.baseBusqueda = config.baseBusqueda.trim();
		this.prefijoGrupos = config.prefijoGrupos?.trim() || 'FED3_';
		this.certificado = Buffer.from(config.certificado);

		this.opcionesTls = {
			ca: [this.certificado]
		}
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('ldap');
		return new ConfiguracionLdap(config);
	}

	/**
	 * Devuelve un objeto con los parámetros de conexión al servidor LDAP que debe utilizarse
	 * para crear la instancia de ActiveDirectory
	 * @param {*} solicitudAutenticacion 
	 */
	getParametrosActiveDirectory(solicitudAutenticacion) {
		return {
			url: this.servidor,
			baseDN: this.baseBusqueda,
			username: solicitudAutenticacion.dominio + '\\' + solicitudAutenticacion.usuario,
			password: solicitudAutenticacion.clave,
			tlsOptions: this.opcionesTls
		}
	}


}



try {
	C = new Configuracion(process.env.F3_CONFIG_FILE || 'config.json');
} catch (excepcion) {
	console.error('Ocurrió un error al cargar la configuración');
	process.exit(1);
}



// Verificando la configuración mínima.
// Los siguientes métodos detienen la ejecución en caso de fallo

// _verificadorConfiguracion.verificarSistemasSap(C);
// _verificadorConfiguracion.verificarHttp(C);
// _verificadorConfiguracion.verificarJWT(C);
//_verificadorConfiguracion.verificarMongodb(C);
//_verificadorConfiguracion.verificarSQLite(C);
//_verificadorConfiguracion.verificarLdap(C);
/*
	C.ldap.tlsOptions = {
		ca: [require('fs').readFileSync(C.ldap.cacert)]
	};
	*/


/*

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

*/
module.exports = C;
