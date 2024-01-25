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
const Balanceador = require('modelos/monitor/Balanceador');

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
		this.numeroWorkers = Validador.esEnteroPositivo(config.numeroWorkers) ? parseInt(config.numeroWorkers) : 1;

		this.sinWatchdogPedidos = Boolean(config.sinWatchdogPedidos);
		this.sinWatchdogSqlite = Boolean(config.sinWatchdogSqlite);
		this.sinMonitor = Boolean(config.sinMonitor);

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
		this.sqlite = await ConfiguracionSqlite.cargar(this);
		this.balanceador = await ConfiguracionBalanceadores.cargar(this);
		this.logistica = await ConfiguracionLogistica.cargar(this);
		this.listaNegra = await ConfiguracionListaNegra.cargar(this);
		this.datosAdicionalesFmas = await ConfiguracionDatosAdicionalesFmas.cargar(this);
	}

	static async cargarObjetoCluster(claveObjeto) {

		// L.d(['Leyendo configuracion del clúster', claveObjeto]);

		let config = null;

		if (M.conectado) {
			try {
				config = await M.col.configuracion.findOne({ _id: claveObjeto });
				// L.i(['Obtenida configuración del clúster', claveObjeto], 'config');
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

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('watchdogSqlite');
		C.sqlite.maximoReintentos = parseInt(config.maximoReintentos) || 10;
		C.sqlite.insercionesSimultaneas = parseInt(config.insercionesSimultaneas) || 10;
		C.sqlite.intervalo = (parseInt(config.intervalo) || 10) * 1000;
		return C.sqlite;
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
		this.destino = new DestinoSap(config.destino);

		this.timeout = {
			verificarCredenciales: (parseInt(config.timeout?.verificarCredenciales) || 5) * 1000,
			realizarPedido: (parseInt(config.timeout?.realizarPedido) || 30) * 1000,
			realizarLogistica: (parseInt(config.timeout?.realizarLogistica) || 30) * 1000,
			realizarDevolucion: (parseInt(config.timeout?.realizarDevolucion) || 15) * 1000,
			consultaDevolucionPDF: (parseInt(config.timeout?.consultaDevolucionPDF) || 10) * 1000,
			consultaAlbaranJSON: (parseInt(config.timeout?.consultaAlbaranJSON) || 10) * 1000,
			consultaAlbaranPDF: (parseInt(config.timeout?.consultaAlbaranPDF) || 10) * 1000,
			listadoAlbaranes: (parseInt(config.timeout?.listadoAlbaranes) || 30) * 1000,
		}
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('sap');
		return new ConfiguracionSap(C, config);
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

	constructor(C, config) {

		if (!config) throw new Error("No se ha definido la configuracion de LDAP ($.ldap)");
		if (!Validador.esCadenaNoVacia(config.servidor)) throw new Error("No se ha definido el servidor LDAP ($.ldap.servidor)");
		if (!Validador.esCadenaNoVacia(config.baseBusqueda)) throw new Error("No se ha definido la base de búsqueda LDAP ($.ldap.baseBusqueda)");


		this.servidor = config.servidor.trim();
		this.baseBusqueda = config.baseBusqueda.trim();
		this.prefijoGrupos = config.prefijoGrupos?.trim() || 'FED3_';
		this.certificados = config.certificados || [];

		this.opcionesTls = {
			ca: this.certificados
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
			tlsOptions: this.opcionesTls,
			baseDN: this.baseBusqueda,
			username: solicitudAutenticacion.dominio + '\\' + solicitudAutenticacion.usuario,
			password: solicitudAutenticacion.clave
		}
	}


}

class ConfiguracionPedidos {
	constructor(C, config) {

		this.umbralLineasCrc = parseInt(config.umbralLineasCrc) || 10;
		this.antiguedadDuplicadosMaxima = (parseInt(config.antiguedadDuplicadosMaxima) || 10080) * 60000;
		this.antiguedadDuplicadosPorLineas = (parseInt(config.antiguedadDuplicadosPorLineas) || 180) * 60000;
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

class ConfiguracionBalanceadores {

	constructor(C, config) {
		this.balanceadores = config.balanceadores.map(balanceador => new Balanceador(balanceador));
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('balanceador');
		return new ConfiguracionBalanceadores(C, config);
	}

	get(nombre) {
		return this.balanceadores.find(b => b.nombre === nombre)
	}
}

class ConfiguracionLogistica {
	constructor(C, config) {

		this.tiposAdmitidos = { ...config.tiposAdmitidos };

	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('logistica');
		return new ConfiguracionLogistica(C, config);
	}
}


class ConfiguracionListaNegra {
	constructor(C, config) {

		this.horaCorte = parseInt(config.horaCorte, 10) || 8;
		this.limitePedido = parseInt(config.limitePedido, 10) || 25;
		this.intervaloRefresco = (parseInt(config.intervaloRefresco, 10) || 60) * 1000;
		this.intervaloRecalculo = (parseInt(config.intervaloRecalculo, 10) || 60) * 1000;

	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('listaNegra');
		return new ConfiguracionListaNegra(C, config);
	}
}

class ConfiguracionDatosAdicionalesFmas {
	constructor(C, config) {
		this.activo = Boolean(config.url);
		this.url = config.url;
	}

	static async cargar(C) {
		let config = await Configuracion.cargarObjetoCluster('datosAdicionalesFmas');
		return new ConfiguracionDatosAdicionalesFmas(C, config);
	}
}

module.exports = Configuracion.cargarDatosFichero;
