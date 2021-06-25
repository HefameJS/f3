'use strict';

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
				case LogServidor.FATAL:
				case LogServidor.ERROR:
					console.log('\u001b[' + 31 + 'm\u001b[' + 7 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case LogServidor.WARN:
					console.log('\u001b[' + 31 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case LogServidor.DEBUG:
				case LogServidor.TRACE:
					console.log('\u001b[' + 36 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case LogServidor.EVENT:
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
class LogServidor {

	prefijo;

	constructor(prefijo) {
		this.prefijo = prefijo;
	}

	#grabarEntrada(datos, nivel) {
		new RegistroLog(datos, nivel, this)
	}

	dump(...datos) {
		this.#grabarEntrada(datos, LogServidor.FATAL);
	}

	trace(...datos) {
		this.#grabarEntrada(datos, LogServidor.TRACE);
	}
	debug(...datos) {
		this.#grabarEntrada(datos, LogServidor.DEBUG);
	}
	info(...datos) {
		this.#grabarEntrada(datos, LogServidor.INFO);
	}
	warn(...datos) {
		this.#grabarEntrada(datos, LogServidor.WARN);
	}
	err(...datos) {
		this.#grabarEntrada(datos, LogServidor.ERROR);
	}
	fatal(...datos) {
		this.#grabarEntrada(datos, LogServidor.FATAL);
	}
	evento(...datos) {
		this.#grabarEntrada(datos, LogServidor.EVENT);
	}
}


LogServidor.TRACE = 'TRC';
LogServidor.DEBUG = 'DBG';
LogServidor.INFO = 'INF';
LogServidor.WARN = 'WRN';
LogServidor.ERROR = 'ERR';
LogServidor.FATAL = 'DIE';
LogServidor.EVENT = 'EVT';




module.exports = async function (prefijo) {
	let l = new LogServidor(prefijo);
	global.L.trace = (...datos) => l.trace(...datos);
	global.L.debug = (...datos) => l.debug(...datos);
	global.L.info = (...datos) => l.info(...datos);
	global.L.warn = (...datos) => l.warn(...datos);
	global.L.err = (...datos) => l.err(...datos);
	global.L.fatal = (...datos) => l.fatal(...datos);
	global.L.evento = (...datos) => l.evento(...datos);
	global.L.dump = (...datos) => l.dump(...datos);
	return;
}
