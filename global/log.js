'use strict';

const fs = require('fs/promises'); fs.constants = require('fs').constants;
const util = require('util');

class RegistroLog {
	fecha;
	nivel;
	datos;
	padre;

	constructor(datos, nivel, padre) {
		this.fecha = new Date();
		this.datos = datos;
		this.nivel = nivel;
		this.padre = padre;

		// Imprimimos
		this.datos.forEach(dato => {

			let mensaje = dato?.message || dato;
			let nivel = this.nivel + (padre.prefijo ? '@' + padre.prefijo : '');

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
	fecha;
	datos;
	padre;

	constructor(datos, padre) {
		this.fecha = new Date();
		this.datos = datos;
		this.padre = padre;

		let ficheroDump = this.#generarNombreFichero(true);
		let mensaje = (new Date).toUTCString()
		mensaje += this.#datos({
			tipo: process.tipo, titulo: process.titulo, iid: process.iid, pid: process.pid, wid: process.worker
		}, 'DATOS DEL PROCESO');

		if (this.padre.transmision) {
			let req = this.padre.transmision.req;
			mensaje += this.#datos({
				txId: this.padre.transmision.txId,
				body: req.body,
				method: req.method,
				url: req.originalUrl,
				httpVersion: req.httpVersion,
				headers: req.headers,

			}, 'DATOS DE LA TRANSMISION');
		}

		this.datos.forEach((dato, i) => {
			mensaje += this.#datos(dato, `ARGUMENTO ${i}`)
		});

		fs.appendFile(ficheroDump, mensaje);
	}

	#datos(dato, titulo) {
		return '\n\n----------------------------------------\n' + titulo + '\n----------------------------------------\n' + util.inspect(dato, 10);
	}

	#generarNombreFichero(dump = false) {
		if (this.padre.transmision) {
			return C.log.directorio + this.padre.transmision.txId + '-' + Date.toSapDate() + (dump ? '.dump' : '.log')
		}
		return C.log.directorio + this.padre.prefijo + '-' + Date.toSapDate() + (dump ? '.dump' : '.log')
	}

}


class Log {

	prefijo;
	transmision;

	constructor(prefijo, transmision) {
		this.prefijo = prefijo;
		this.transmision = transmision;
	}

	#grabarEntrada(datos, nivel) {
		new RegistroLog(datos, nivel, this)
	}

	dump(...datos) {
		new RegistroDump(datos, this);
	}
	trace(...datos) {
		this.#grabarEntrada(datos, Log.TRACE);
	}
	debug(...datos) {
		this.#grabarEntrada(datos, Log.DEBUG);
	}
	info(...datos) {
		this.#grabarEntrada(datos, Log.INFO);
	}
	warn(...datos) {
		this.#grabarEntrada(datos, Log.WARN);
	}
	err(...datos) {
		this.#grabarEntrada(datos, Log.ERROR);
	}
	fatal(...datos) {
		this.#grabarEntrada(datos, Log.FATAL);
	}
	evento(...datos) {
		this.#grabarEntrada(datos, Log.EVENT);
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
	let l = new Log(prefijo);

	global.L.trace = (...datos) => l.trace(...datos);
	global.L.debug = (...datos) => l.debug(...datos);
	global.L.info = (...datos) => l.info(...datos);
	global.L.warn = (...datos) => l.warn(...datos);
	global.L.err = (...datos) => l.err(...datos);
	global.L.fatal = (...datos) => l.fatal(...datos);
	global.L.evento = (...datos) => l.evento(...datos);
	global.L.dump = (...datos) => l.dump(...datos);

	global.L.instanciar = (transmision) => new Log(transmision.txId, transmision);

	return;
}
