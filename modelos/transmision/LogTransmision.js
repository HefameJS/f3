'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


class RegistroLogTransmision {
	fecha;
	nivel;
	datos;

	constructor(datos, nivel) {
		this.fecha = new Date();
		this.datos = datos;
		this.nivel = nivel;

		// Imprimimos
		this.datos.forEach(dato => {

			switch (this.nivel) {
				case LogTransmision.FATAL:
				case LogTransmision.ERROR:
					console.log('\u001b[' + 31 + 'm\u001b[' + 7 + 'm', this.nivel, '\u001b[0m', dato?.message || dato);
					break;
				case LogTransmision.WARN:
					console.log('\u001b[' + 31 + 'm', this.nivel, '\u001b[0m', dato?.message || dato);
					break;
				case LogTransmision.DEBUG:
				case LogTransmision.TRACE:
					console.log('\u001b[' + 36 + 'm', this.nivel, '\u001b[0m', dato?.message || dato);
					break;
				case LogTransmision.EVENT:
					console.log('\u001b[' + 36 + 'm\u001b[' + 7 + 'm', this.nivel, '\u001b[0m', dato?.message || dato);
					break;
				default:
					console.log('\u001b[' + 32 + 'm', this.nivel, '\u001b[0m', dato?.message || dato);
					//32
			}

		});
	}


}

class LogTransmision {

	#transmision;
	#registros;

	constructor(transmision) {
		this.#registros = [];
		this.transmision = transmision;
	}

	get registros() {
		return this.#registros;
	}

	#grabarEntrada(datos, nivel) {
		let registro = new RegistroLogTransmision(datos, nivel)
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