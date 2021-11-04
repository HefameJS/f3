'use strict';
const M = global.M;
const util = require('util');
const fs = require('fs/promises');
const fsc = require('fs');
const path = require('path');
const SEPARADOR_DIRECTORIOS = path.sep;

const Transmision = require('modelos/transmision/Transmision');
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');



class RegistroLog {
	fecha;
	nivel;
	datos;

	constructor(datos, nivel,) {
		this.fecha = new Date();
		this.datos = datos;
		this.nivel = nivel;
	}

	obtenerMensajes() {
		let mensajes = [];
		this.datos.forEach(dato => {
			let mensaje = dato?.message || dato;
			if (Array.isArray(mensaje) || typeof mensaje === "object") mensaje = util.inspect(mensaje)
			mensajes.push(`${Date.logLargo(this.fecha)}|${this.nivel}|${mensaje}`)
			if (dato?.stack) mensajes.push(dato.stack);
		});
		return mensajes;
	}

	imprimirEnConsola(prefijo) {
		this.datos.forEach(dato => {
			let mensaje = dato?.message || dato;
			let nivel = this.nivel + (prefijo ? '@' + prefijo : '');

			switch (this.nivel) {
				case Log.FATAL:
				case Log.ERROR:
					console.log('\u001b[' + 31 + 'm\u001b[' + 7 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case Log.WARN:
					console.log('\u001b[' + 31 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case Log.DEBUG:
				case Log.TRACE:
					console.log('\u001b[' + 36 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case Log.EVENT:
					console.log('\u001b[' + 36 + 'm\u001b[' + 7 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				default:
					console.log('\u001b[' + 32 + 'm', nivel, '\u001b[0m', mensaje);
				//32
			}
			if (dato?.stack) {
				console.log(dato.stack)
			}
		});
	}
}

class RegistroDump {

	rutaFicheroDump;

	constructor(datos, prefijo, transmision) {
		let fecha = new Date();

		let directorio = C.log.getDirectorioDump(true);
		let extension = Date.fedicomTimestamp() + '.dump';
		this.rutaFicheroDump = directorio + prefijo + '.' + extension;

		let mensaje = fecha.toUTCString()
		mensaje += '\n\n----------------------------------------\n DATOS DEL PROCESO \n----------------------------------------\n';

		mensaje += util.inspect({
			tipo: process.tipo,
			titulo: process.titulo,
			iid: process.iid,
			pid: process.pid,
			wid: process.worker
		}, false, 10);

		if (transmision) {
			let req = transmision.req;
			mensaje += '\n\n----------------------------------------\n DATOS DE LA TRANSMISION \n----------------------------------------\n';
			mensaje += util.inspect({
				txId: transmision.txId,
				body: req.body,
				method: req.method,
				url: req.originalUrl,
				httpVersion: req.httpVersion,
				headers: req.headers,
			}, false, 10);
		}

		datos.forEach((dato, i) => {
			mensaje += `\n\n----------------------------------------\n ARGUMENTO ${i} \n----------------------------------------\n`;
			mensaje += util.inspect(dato, false, 10)
		});

		fs.mkdir(directorio, { recursive: true, mode: 0o755 })
			.then(() => fs.appendFile(this.rutaFicheroDump, mensaje, { encoding: 'utf8' }))
			.catch((error) => {
				console.error('ERROR AL ESCRIBIR FICHERO DE DUMP', error);
				console.error(mensaje);
			})
	}
}

class Log {

	prefijo;
	transmision;
	tipo = 'Proceso';

	constructor(transmision, tipo, prefijo) {
		this.transmision = transmision;
		this.tipo = tipo;
		this.prefijo = prefijo;
	}

	insertarEntradaLog(datos, nivel) {
		let entrada = new RegistroLog(datos, nivel);
		if (C.log.consola) entrada.imprimirEnConsola(this.prefijo);
		return entrada;
	}

	dump(...datos) {
		let dump = new RegistroDump(datos, this.prefijo, this.transmision);
		this.insertarEntradaLog(['################## GENERADO DUMP:', dump.rutaFicheroDump], Log.FATAL);
	}
	trace(...datos) {
		this.insertarEntradaLog(datos, Log.TRACE);
	}
	debug(...datos) {
		this.insertarEntradaLog(datos, Log.DEBUG);
	}
	info(...datos) {
		this.insertarEntradaLog(datos, Log.INFO);
	}
	warn(...datos) {
		this.insertarEntradaLog(datos, Log.WARN);
	}
	err(...datos) {
		this.insertarEntradaLog(datos, Log.ERROR);
	}
	fatal(...datos) {
		this.insertarEntradaLog(datos, Log.FATAL);
	}
	evento(...datos) {
		this.insertarEntradaLog(datos, Log.EVENT);
	}
}

class LogMongo extends Log {

	bufferEntradas = [];
	entradaPendienteEscribir = null;

	constructor(transmision, tipo, prefijo) {
		super(transmision, tipo, prefijo);
	}


	moverCola() {

		// Ya es esta escribiendo
		if (this.entradaPendienteEscribir) return;

		this.entradaPendienteEscribir = this.bufferEntradas.shift();

		if (this.entradaPendienteEscribir) {
			setTimeout(async () => {
				try {
					await M.col.logs.updateOne(
						{ _id: this.prefijo },
						{ '$push': { l: this.entradaPendienteEscribir } },
						{ upsert: true }
					);

					this.entradaPendienteEscribir = null;
					this.moverCola();
				}
				catch (error) {
					console.error('ERROR ESCRIBIENDO LOG A MONGO', error)
				}
			}, 1)
		}
	}

	insertarEntradaLog(datos, nivel) {
		let entrada = super.insertarEntradaLog(datos, nivel);
		this.bufferEntradas.push(entrada);
		this.moverCola();
	}
}

class LogFichero extends Log {

	fechaGeneracionDirectiorioLog = null;
	ficheroLog = null;
	stream;

	bufferEntradas = [];
	entradaPendienteEscribir = null;

	constructor(transmision, tipo, prefijo) {
		super(transmision, tipo, prefijo);
	}

	async generarNombreFichero() {

		// El destino de los logs de 'Transmision', no varía el destino del fichero ya que solo depende del txId
		// por lo que podemos cachear el nombre del mismo.
		if (this.tipo === 'Transmision' && this.ficheroLog) return this.ficheroLog;

		// Si no ha cambiado la fecha de generacion del fichero de log, retornamos el mismo nombre de fichero
		let fechaActual = Date.logCorto()
		if (this.ficheroLog && fechaActual === this.fechaGeneracionDirectiorioLog) {
			return this.ficheroLog;
		}

		this.fechaGeneracionDirectiorioLog = fechaActual;
		let directorioBase = C.log.directorio + SEPARADOR_DIRECTORIOS + fechaActual + SEPARADOR_DIRECTORIOS;

		switch (this.tipo) {
			case 'Transmision': {
				// Los 8 primeros dígitos en hex de un ObjectID son el timestamp (8 digitos hex -> 4 bytes).
				// Cogiendo los 6 primeros digitos del ID para generar un subdirectorio estaríamos
				// quitando 1 byte del total, luego redondeamos a 2^8 = 256 segundos =)
				// Así evitamos tener miles de ficheros en un mismo directorio
				let subdir1 = this.transmision.txId.toHexString().substring(0, 6);
				directorioBase = C.log.directorio + SEPARADOR_DIRECTORIOS + 'transmisiones' + SEPARADOR_DIRECTORIOS + subdir1 + SEPARADOR_DIRECTORIOS;
				let fichero = this.transmision.txId + '.log';
				this.ficheroLog = {
					directorio: directorioBase,
					fichero,
					rutaCompleta: directorioBase + fichero
				}
				break;
			}
			case 'TransmisionLigera': {
				this.ficheroLog = {
					directorio: directorioBase,
					fichero: 'monitor.log',
					rutaCompleta: directorioBase + 'monitor.log'
				}
				break;
			}
			default: {
				let fichero = this.prefijo + '.log'
				this.ficheroLog = {
					directorio: directorioBase,
					fichero,
					rutaCompleta: directorioBase + fichero
				}
			}
		}

		await fs.mkdir(this.ficheroLog.directorio, { recursive: true, mode: 0o755 });
		if (this.stream) this.stream.end();
		this.stream = fsc.createWriteStream(this.ficheroLog.rutaCompleta, { flags: 'a', encoding: 'utf8' });

	}

	moverCola() {

		// Ya es esta escribiendo
		if (this.entradaPendienteEscribir) return;

		this.entradaPendienteEscribir = this.bufferEntradas.shift();
		if (this.entradaPendienteEscribir) {
			setTimeout(async () => {
				try {
					await this.generarNombreFichero();
					let mensajes = this.entradaPendienteEscribir.obtenerMensajes();
					if (mensajes.length) {
						let texto = mensajes.join('\r\n')
						await new Promise((resolve, reject) => {
							this.stream.write(texto + '\r\n', 'utf8', (error) => {
								if (error) reject(error)
								resolve();
							})
						})
					}
					this.entradaPendienteEscribir = null;
					this.moverCola();
				}
				catch (error) {
					console.error('ERROR ESCRIBIENDO LOG', error)
				}
			}, 1)
		}
	}

	insertarEntradaLog(datos, nivel) {
		let entrada = super.insertarEntradaLog(datos, nivel);
		this.bufferEntradas.push(entrada);
		this.moverCola();
	}
}


Log.TRACE = 'TRC';
Log.DEBUG = 'DBG';
Log.INFO = 'INF';
Log.WARN = 'WRN';
Log.ERROR = 'ERR';
Log.FATAL = 'DIE';
Log.EVENT = 'EVT';
Log.DUMP = 'DMP';




module.exports = async function (prefijo) {

	let loggerProceso = new LogFichero(null, 'Proceso', prefijo);

	global.L.trace = (...datos) => loggerProceso.trace(...datos);
	global.L.debug = (...datos) => loggerProceso.debug(...datos);
	global.L.info = (...datos) => loggerProceso.info(...datos);
	global.L.warn = (...datos) => loggerProceso.warn(...datos);
	global.L.err = (...datos) => loggerProceso.err(...datos);
	global.L.fatal = (...datos) => loggerProceso.fatal(...datos);
	global.L.evento = (...datos) => loggerProceso.evento(...datos);
	global.L.dump = (...datos) => loggerProceso.dump(...datos);

	global.L.instanciar = (transmision, tipo) => {
		switch (tipo) {
			case 'Transmision':
				return new LogMongo(transmision, tipo, transmision.txId);
			case 'TransmisionLigera':
				return new LogFichero(transmision, tipo, transmision.txId);
			default:
				return loggerProceso;
		}

	}

	return;
}
