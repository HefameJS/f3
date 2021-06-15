'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


class RegistroLogTransmision {
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
				case LogTransmision.FATAL:
				case LogTransmision.ERROR:
					console.log('\u001b[' + 31 + 'm\u001b[' + 7 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case LogTransmision.WARN:
					console.log('\u001b[' + 31 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case LogTransmision.DEBUG:
				case LogTransmision.TRACE:
					console.log('\u001b[' + 36 + 'm', nivel, '\u001b[0m', mensaje);
					break;
				case LogTransmision.EVENT:
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

class LogTransmision {

	#transmision;
	#registros;
	#prefijo;

	constructor(transmision, prefijo = '') {
		this.#transmision = transmision;
		this.#registros = [];
		this.#prefijo = prefijo;
	}

	get registros() {
		return this.#registros;
	}

	get prefijo() {
		return this.#prefijo;
	}

	#grabarEntrada(datos, nivel) {
		let registro = new RegistroLogTransmision(datos, nivel, this)
		this.#registros.push(registro);
	}

	trace(...datos) {
		this.#grabarEntrada(datos, LogTransmision.TRACE);
	}
	debug(...datos) {
		this.#grabarEntrada(datos, LogTransmision.DEBUG);
	}
	info(...datos) {
		this.#grabarEntrada(datos, LogTransmision.INFO);
	}
	warn(...datos) {
		this.#grabarEntrada(datos, LogTransmision.WARN);
	}
	err(...datos) {
		this.#grabarEntrada(datos, LogTransmision.ERROR);
	}
	fatal(...datos) {
		this.#grabarEntrada(datos, LogTransmision.FATAL);
	}
	evento(...datos) {
		this.#grabarEntrada(datos, LogTransmision.EVENT);
	}

}

LogTransmision.TRACE = 'TRC';
LogTransmision.DEBUG = 'DBG';
LogTransmision.INFO = 'INF';
LogTransmision.WARN = 'WRN';
LogTransmision.ERROR = 'ERR';
LogTransmision.FATAL = 'DIE';
LogTransmision.EVENT = 'EVT';


module.exports = LogTransmision;