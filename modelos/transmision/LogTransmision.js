'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


class RegistroLogTransmision {
	fecha;
	nivel;
	datos;

	constructor( datos, nivel ) {
		this.fecha = new Date();
		this.datos = datos;

		if (!Array.isArray(this.datos)) {
			this.datos = [this.datos];
		}

		this.nivel = nivel;


		//
		this.datos.forEach(dato => {
			console.log(LogTransmision[this.nivel], this.fecha, dato)
		});

	}


}

class LogTransmision {

	registros = [];

	constructor() {

	}

	#grabarEntrada (datos, nivel) {
		let registro = new RegistroLogTransmision(datos, nivel)
		this.registros.push(registro);
	}

	trace(datos) {
		this.#grabarEntrada(datos, LogTransmision.TRACE);
	}
	debug(datos) {
		this.#grabarEntrada(datos, LogTransmision.DEBUG);
	}
	info(datos) {
		this.#grabarEntrada(datos, LogTransmision.INFO);
	}
	warn(datos) {
		this.#grabarEntrada(datos, LogTransmision.WARN);
	}
	err(datos) {
		this.#grabarEntrada(datos, LogTransmision.ERROR);
	}
	fatal(datos) {
		this.#grabarEntrada(datos, LogTransmision.FATAL);
	}
	evento(datos) {
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