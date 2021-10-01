'use strict';
const L = global.L;
const M = global.M;
const C = global.C;

const fs = require('fs/promises'); fs.constants = require('fs').constants;
const OS = require('os')
const SEPARADOR_DIRECTORIOS = require('path').sep;


const DestinoSap = require('modelos/DestinoSap');
const Balanceador = require('modelos/_monitor/Balanceador');
const Validador = require('global/validador');

const SUBDIR = {
	LOGS: 'logs',
	SQLITE: 'db',
	CONFIG: 'config'
}


class Configuracion {

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


		if (!(config.produccion === true || config.produccion === false))
			throw new Error("No se ha definido el nodo PRODUCTION (produccion) a TRUE o FALSE. Por motivos de seguridad, esto es obligatorio.");

		global.C.produccion = Boolean(config.produccion);
		global.C.numeroWorkers = Validador.esEnteroPositivo(config.numeroWorkers) ? parseInt(config.numeroWorkers) : 1;

		global.C.sinWatchdogPedidos = Boolean(config.sinWatchdogPedidos);
		global.C.sinWatchdogSqlite = Boolean(config.sinWatchdogSqlite);
		global.C.sinMonitor = Boolean(config.sinMonitor);

		// El directorio de cache sabemos que existe y que es escribible
		// porque el objeto se instancia como Configuracion.cargarDatosFichero(rutaFichero)
		global.C.directorioCache = config.directorioCache;

		// Objetos complejos
		global.C.mongodb = new ConfiguracionMongodb(config.mongodb);
		global.C.pid = new ConfiguracionPid(config.pid);
		global.C.log = new ConfiguracionLog(config.log);
		global.C.sqlite = new ConfiguracionSqlite(config.sqlite);
		global.C.http = new ConfiguracionHttp(config.http);


	}

	static async cargarConfiguracionCluster() {
		global.C.jwt = await ConfiguracionJwt.cargar();
		global.C.sap = await ConfiguracionSap.cargar();
		global.C.ldap = await ConfiguracionLdap.cargar();
		global.C.pedidos = await ConfiguracionPedidos.cargar();
		global.C.devoluciones = await ConfiguracionDevoluciones.cargar();
		global.C.watchdogPedidos = await ConfiguracionWatchdogPedidos.cargar();
		global.C.sqlite = await ConfiguracionSqlite.cargar();
		global.C.balanceador = await ConfiguracionBalanceadores.cargar();
		global.C.logistica = await ConfiguracionLogistica.cargar();
	}

	static async cargarObjetoCluster(claveObjeto) {

		L.debug(`Leyendo configuracion del clúster para el objeto ${claveObjeto}`);

		let config = null;

		try {
			config = await M.col.configuracion.findOne({ _id: claveObjeto });
			// L.i(['Obtenida configuración del clúster', claveObjeto], 'config');
		} catch (errorMongo) {
			L.err(`Ocurrió un error en la consulta de configuración de ${claveObjeto}. Usamos configuración en caché`, errorMongo)
		}

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
	constructor(nodoJson) {
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
	constructor(config) {
		this.consola = Boolean(config?.consola);
		this.directorio = global.C.directorioCache + SUBDIR.LOGS;
	}
}

class ConfiguracionPid {
	constructor(config) {
		this.directorio = global.C.directorioCache;
	}

	getFicheroPid() {
		return this.directorio + '/' + process.titulo + '.pid';
	}

	async escribirFicheroPid() {
		try {
			await fs.writeFile(this.getFicheroPid(), '' + process.pid);
		} catch (errorFicheroPid) {

		}
	}

	borrarFicheroPid() {
		fs.unlink(this.getFicheroPid(), () => { });
	}
}

class ConfiguracionSqlite {
	constructor(config) {
		this.directorio = global.C.directorioCache + SUBDIR.SQLITE + SEPARADOR_DIRECTORIOS;
		this.fichero = this.directorio + 'db.sqlite';
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('watchdogSqlite');
		global.C.sqlite.maximoReintentos = parseInt(config.maximoReintentos) || 10;
		global.C.sqlite.insercionesSimultaneas = parseInt(config.insercionesSimultaneas) || 10;
		global.C.sqlite.intervalo = (parseInt(config.intervalo) || 10) * 1000;
		return global.C.sqlite;
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
		this.destino = new DestinoSap(config.destino);

		this.timeout = {
			verificarCredenciales: (parseInt(config.timeout?.verificarCredenciales) || 5) * 1000,
			realizarPedido: (parseInt(config.timeout?.realizarPedido) || 60) * 1000,
			realizarLogistica: (parseInt(config.timeout?.realizarLogistica) || 30) * 1000,
			realizarDevolucion: (parseInt(config.timeout?.realizarDevolucion) || 15) * 1000,
			consultaDevolucionPDF: (parseInt(config.timeout?.consultaDevolucionPDF) || 10) * 1000,
			consultaAlbaranJSON: (parseInt(config.timeout?.consultaAlbaranJSON) || 10) * 1000,
			consultaAlbaranPDF: (parseInt(config.timeout?.consultaAlbaranPDF) || 10) * 1000,
			listadoAlbaranes: (parseInt(config.timeout?.listadoAlbaranes) || 30) * 1000,
		}
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('sap');
		return new ConfiguracionSap(config);
	}

}



class ConfiguracionLdap {

	constructor(config) {

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
			tlsOptions: this.opcionesTls,
			baseDN: this.baseBusqueda,
			username: solicitudAutenticacion.dominio + '\\' + solicitudAutenticacion.usuario,
			password: solicitudAutenticacion.clave
		}
	}


}

// "estadosQueAceptanEjecucionDeDuplicados": ["ERROR_CONCENTRADOR", "PEDIDO.RECHAZADO_SAP"]
class ConfiguracionPedidos {
	constructor(config) {
		this.umbralLineasCrc = parseInt(config.umbralLineasCrc) || 10;
		this.antiguedadDuplicadosMaxima = (parseInt(config.antiguedadDuplicadosMaxima) || 10080) * 60000;
		this.antiguedadDuplicadosPorLineas = (parseInt(config.antiguedadDuplicadosPorLineas) || 180) * 60000;
		this.tipificadoFaltas = { ...config.tipificadoFaltas };

		this.estadosQueAceptanEjecucionDeDuplicados = config.estadosQueAceptanEjecucionDeDuplicados?.map?.(nombreEstado => {
			let trozosNombre = nombreEstado.split('.');
			let constante = K.ESTADOS;
			trozosNombre.forEach(trozo => (constante = constante[trozo]))
			return constante;
		})
	}

	sePermiteEjecutarDuplicado( estado ) {
		return this.estadosQueAceptanEjecucionDeDuplicados.includes(estado);
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('pedidos');
		return new ConfiguracionPedidos(config);
	}
}

class ConfiguracionDevoluciones {
	constructor(config) {
		this.motivos = { ...config.motivos };
		this.motivosExtentosAlbaran = config.motivosExtentosAlbaran || [];
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('devoluciones');
		return new ConfiguracionDevoluciones(config);
	}

	motivoExentoDeAlbaran(motivo) {
		return this.motivosExtentosAlbaran.includes(motivo);
	}
}

class ConfiguracionWatchdogPedidos {
	constructor(config) {
		this.servidor = config.servidor;
		this.intervalo = (parseInt(config.intervalo) || 5) * 1000;
		this.antiguedadMinima = (parseInt(config.antiguedadMinima) || 300) * 1000;
		this.transmisionesSimultaneas = parseInt(config.transmisionesSimultaneas) || 10;
		this.numeroPingsSap = parseInt(config.numeroPingsSap) || 3;
		this.intervaloPingsSap = (parseInt(config.intervaloPingsSap) || 5) * 1000;
		this.maximoReintentos = parseInt(config.maximoReintentos) || 5;
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('watchdogPedidos');
		return new ConfiguracionWatchdogPedidos(config);
	}

	soyMaestro() {
		return OS.hostname().toLowerCase() === this.servidor;
	}
}

class ConfiguracionBalanceadores {

	constructor(config) {
		this.balanceadores = config.balanceadores.map(balanceador => new Balanceador(balanceador));
	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('balanceador');
		return new ConfiguracionBalanceadores(config);
	}

	get(nombre) {
		return this.balanceadores.find(b => b.nombre === nombre)
	}
}


class ConfiguracionLogistica {
	constructor(config) {

		this.tiposAdmitidos = { ...config.tiposAdmitidos };

	}

	static async cargar() {
		let config = await Configuracion.cargarObjetoCluster('logistica');
		return new ConfiguracionLogistica(config);
	}
}

module.exports = async function (ficheroConfiguracion) {
	await Configuracion.cargarDatosFichero(ficheroConfiguracion);
	global.C.cargarConfiguracionCluster = Configuracion.cargarConfiguracionCluster
};
