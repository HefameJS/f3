'use strict';
const C = global.config;
const L = require('./logger');
//const K = global.constants;
let M = global.mongodb;

// externas
const fs = require('fs/promises'); fs.constants = require('fs').constants;
const OS = require('os')
const SEPARADOR_DIRECTORIOS = require('path').sep;

// modelos
const DestinoSap = require('modelos/DestinoSap');

// util
const Validador = require('global/validador');

const SUBDIR = {
	LOGS: 'logs',
	SQLITE: 'db',
	CONFIG: 'config'
}


class Configuracion {
	constructor(config) {

		this.listeners = [];

		if (!(config.produccion === true || config.produccion === false))
			throw new Error("No se ha definido el nodo PRODUCTION (produccion) a TRUE o FALSE. Por motivos de seguridad, esto es obligatorio.");

		this.produccion = Boolean(config.produccion);
		this.numeroWorkers = Validador.esEnteroPositivoMayorQueCero(config.numeroWorkers) ? parseInt(config.numeroWorkers) : 1;

		// El directorio de cache sabemos que existe y que es escribible
		// porque el objeto se instancia como Configuracion.cargarDatosFichero(rutaFichero)
		this.directorioCache = config.directorioCache;

		// Objetos complejos
		this.mongodb = new ConfiguracionMongodb(this, config.mongodb);
		this.pid = new ConfiguracionPid(this, config.pid);
		this.log = new ConfiguracionLog(this, config.log);
		this.sqlite = new ConfiguracionSqlite(this, config.sqlite);
		this.http = new ConfiguracionHttp(this, config.http);

	}

	registrarListener(funcion) {
		if (funcion && typeof funcion === 'function')
			this.listeners.push(funcion);
	}

	static async cargarDatosFichero(ficheroConfiguracion) {

		let config;
		try {
			config = require(ficheroConfiguracion);
		} catch (excepcion) {
			console.error("No se encuentra el fichero de configuración", ficheroConfiguracion);
			console.error(excepcion);
			process.exit(1);
		}

		if (!Validador.esCadenaNoVacia(config.directorioCache))
			throw new Error("No se ha definido el nodo cache. Este nodo es obligatorio.");

		config.directorioCache = config.directorioCache.trim();
		if (!config.directorioCache.endsWith(SEPARADOR_DIRECTORIOS)) {
			config.directorioCache += SEPARADOR_DIRECTORIOS;
		}


		await fs.mkdir(config.directorioCache, { recursive: true, mode: 0o755 })
		if (!(await fs.lstat(config.directorioCache)).isDirectory()) {
			throw new Error("La ruta indicada en el nodo cache no es un directorio.");
		}
		await fs.access(config.directorioCache, fs.constants.W_OK | fs.constants.R_OK);

		for (let DIR in SUBDIR) {
			await fs.mkdir(config.directorioCache + SUBDIR[DIR], { recursive: true, mode: 0o755 });
		}


		return new Configuracion(config);

	}

	async cargarDatosCluster() {
		M = global.mongodb;
		this.jwt = await ConfiguracionJwt.cargar(this);
		this.sap = await ConfiguracionSap.cargar(this);
		this.dominios = await ConfiguracionDominios.cargar(this);
		this.flags = await ConfiguracionFlags.cargar(this);
		this.ldap = await ConfiguracionLdap.cargar(this);
		this.pedidos = await ConfiguracionPedidos.cargar(this);
		this.devoluciones = await ConfiguracionDevoluciones.cargar(this);
		this.softwareId = await ConfiguracionSoftwareId.cargar(this);
		this.watchdogPedidos = await ConfiguracionWatchdogPedidos.cargar(this);
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
			L.e(['No hay conexión con el clúster. Intentamos utilizar la caché.'])
		}

		let C = global.config;
		let directorioCacheConfig = C.directorioCache + SUBDIR.CONFIG + SEPARADOR_DIRECTORIOS + claveObjeto + '.config';
		if (!config) {
			config = await fs.readFile(directorioCacheConfig, { encoding: 'utf8', flag: 'r' });
			config = JSON.parse(config);
		} else {
			await fs.writeFile(directorioCacheConfig, JSON.stringify(config), { encoding: 'utf8', mode: 0o600, flag: 'w' });
		}

		return config;
	}
}

class ConfiguracionMongodb {
	constructor(C, nodoJson) {
		if (!nodoJson) throw new Error("No se ha definido el nodo para MongoDB (mongodb)");
		if (!Validador.esArrayNoVacio(nodoJson.servidores)) throw new Error("No se ha definido la lista de servidores de MongoDB (mongodb.servidores)");
		if (!Validador.esCadenaNoVacia(nodoJson.usuario)) throw new Error("No se ha definido el usuario para MongoDB (mongodb.usuario)");
		if (!Validador.esCadenaNoVacia(nodoJson.password)) throw new Error("No se ha definido la password para el usuario de MongoDB (mongodb.password)");
		if (!Validador.esCadenaNoVacia(nodoJson.database)) throw new Error("No se ha definido el nombre de la base de datos de MongoDB (mongodb.database)");

		// Verificación de los servidores
		this.servidores = nodoJson.servidores
			.filter(servidor => Validador.esCadenaNoVacia(servidor))
			.map(servidor => servidor.trim());

		if (!Validador.esArrayNoVacio(nodoJson.servidores)) throw new Error("No hay ningún servidor MongoDB válido en la lista de servidores (mongodb.servidores)");

		this.usuario = nodoJson.usuario.trim();
		this.password = nodoJson.password;
		this.database = nodoJson.database.trim();

		if (Validador.esCadenaNoVacia(nodoJson.replicaSet)) {
			this.replicaSet = nodoJson.replicaSet.trim();
		}

		this.intervaloReconexion = Validador.esEnteroPositivoMayorQueCero(nodoJson.intervaloReconexion) ? parseInt(nodoJson.intervaloReconexion) : 5000;

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
			useUnifiedTopology: true,
			appname: process.iid,
			loggerLevel: 'warn'
		};
	}
	//TODO: asdasdasd
}

class ConfiguracionLog {
	constructor(C, config) {
		this.consola = Boolean(config?.consola);
		this.directorio = C.directorioCache + SUBDIR.LOGS + SEPARADOR_DIRECTORIOS;
	}
}

class ConfiguracionPid {
	constructor(C, config) {
		this.directorio = C.directorioCache;
	}

	getFicheroPid() {
		return this.directorio + '/' + process.titulo + '.pid';
	}

	async escribirFicheroPid() {
		try {
			await fs.writeFile(this.getFicheroPid(), '' + process.pid);
		} catch (errorFicheroPid) {
			if (L) L.e(["Error al escribir el fichero del PID", errorFicheroPid]);
			else console.error('Error al escribir el fichero del PID', errorFicheroPid)
		}
	}

	borrarFicheroPid() {
		fs.unlink(this.getFicheroPid(), () => { });
	}
}

class ConfiguracionSqlite {
	constructor(C, config) {
		this.directorio = C.directorioCache + SUBDIR.SQLITE + SEPARADOR_DIRECTORIOS;
		this.fichero = this.directorio + 'db.sqlite';
	}
}

class ConfiguracionHttp {

	constructor(C, config) {
		this.puertoConcentrador = parseInt(config?.puertoConcentrador) || 5000;
		this.puertoConsultas = parseInt(config?.puertoConsultas) || 5001;
	}

}

class ConfiguracionJwt {

	constructor(C, config) {
		this.clave = config.clave;
		this.ttl = parseInt(config.ttl) || 3600;
		this.tiempoDeGracia = parseInt(config.tiempoDeGracia) || 60;
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('jwt');
		return new ConfiguracionJwt(C, config);
	}

}

class ConfiguracionSap {

	constructor(C, config) {
		this.nombreSistemaPorDefecto = config.sistemaPorDefecto;
		this.destinos = []
		config.destinos.forEach(destinoSap => {
			this.destinos.push(new DestinoSap(destinoSap))
		});

		this.destinoPorDefecto = this.destinos.find(destino => {
			return destino.id === this.nombreSistemaPorDefecto
		})

	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('sap');
		return new ConfiguracionSap(C, config);
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

	constructor(C, config) {


		if (!config) throw new Error("No se ha definido la configuracion de dominios de autenticacion ($.dominios)");
		if (!config.dominios) throw new Error("No se ha definido la configuracion de dominios de autenticacion ($.dominios.dominios)");
		if (!Object.keys(config.dominios).length) throw new Error("La lista de dominios de autenticacion está vacía ($.dominios.dominios)");

		Object.assign(this, config.dominios)

		this.nombreDominioPorDefecto = config.dominioPorDefecto || Object.keys(config.dominios)[0];
		this.principal = this[this.nombreDominioPorDefecto];

		if (!this.principal) throw new Error("No existe el dominio por defecto ($.dominios.dominios)");

	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('dominios');
		return new ConfiguracionDominios(C, config);
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

	constructor(C, config) {
		if (!config) throw new Error("No se ha definido la configuracion de flags ($.flags)");
		if (!config.flags) throw new Error("No se ha definido la configuracion de flags ($.flags.flags)");
		if (!Object.keys(config.flags).length) throw new Error("La lista de flags está vacía ($.flags.flags)");
		Object.assign(this, config.flags);
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('flags');
		return new ConfiguracionFlags(C, config);
	}

}

class ConfiguracionLdap {

	/**C.ldap.tlsOptions = {
			ca: [require('fs').readFileSync(C.ldap.cacert)]
		}; */

	constructor(C, config) {

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

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('ldap');
		return new ConfiguracionLdap(C, config);
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

class ConfiguracionPedidos {
	constructor(C, config) {

		this.umbralLineasCrc = parseInt(config.umbralLineasCrc) || 10;
		this.antiguedadDuplicadosMaxima = parseInt(config.antiguedadDuplicadosMaxima) || 604800000;
		this.tipificadoFaltas = { ...config.tipificadoFaltas };

	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('pedidos');
		return new ConfiguracionPedidos(C, config);
	}
}

class ConfiguracionDevoluciones {
	constructor(C, config) {
		this.motivos = { ...config.motivos };
		this.motivosExtentosAlbaran = config.motivosExtentosAlbaran || [];
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('devoluciones');
		return new ConfiguracionDevoluciones(C, config);
	}

	motivoExentoDeAlbaran(motivo) {
		return this.motivosExtentosAlbaran.includes(motivo);
	}
}

class ConfiguracionSoftwareId {
	constructor(C, config) {
		this.servidor = config.servidor;
		this.retransmisor = config.retransmisor;
		this.codigos = { ...config.codigos };
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('softwareId');
		return new ConfiguracionSoftwareId(C, config);
	}
}

class ConfiguracionWatchdogPedidos {
	constructor(C, config) {
		this.servidor = config.servidor;
		this.intervalo = (parseInt(config.intervalo) || 5) * 1000;
		this.antiguedadMinima = (parseInt(config.antiguedadMinima) || 300) * 1000;
		this.transmisionesSimultaneas = parseInt(config.transmisionesSimultaneas) || 10;
		this.numeroPingsSap = parseInt(config.numeroPingsSap) || 3;
		this.intervaloPingsSap = (parseInt(config.intervaloPingsSap) || 5) * 1000;
		this.maximoReintentos = parseInt(config.maximoReintentos) || 5;
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('watchdogPedidos');
		return new ConfiguracionWatchdogPedidos(C, config);
	}

	soyMaestro() {
		return OS.hostname().toLowerCase() === this.servidor;
	}
}




module.exports = Configuracion.cargarDatosFichero;
