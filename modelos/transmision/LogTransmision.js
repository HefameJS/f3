'use strict';

const fs = require('fs/promises'); fs.constants = require('fs').constants;
const util = require('util');

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




class RegistroDumpTransmision {
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

		let req = this.padre.transmision.req;

		mensaje += this.#datos({
			body: req.body,
			method: req.method,
			url: req.originalUrl,
			httpVersion: req.httpVersion,
			headers: req.headers,

		}, 'DATOS DE LA TRANSMISION');

		this.datos.forEach((dato, i) => {
			//if (dato?.stack) {
			//	mensaje += this.#datos(dato.stack, `PILA DE EJECUCION DEL ERROR EN ARGUMENTO ${i}`)
			//} else {
				mensaje += this.#datos(dato, `ARGUMENTO ${i}`)
			//}
		});

		fs.appendFile(ficheroDump, mensaje);
	}

	#datos(dato, titulo) {
		return '\n\n----------------------------------------\n' + titulo + '\n----------------------------------------\n' + util.inspect(dato, 10);
	}

	#generarNombreFichero(dump = false) {
		return C.log.directorio + this.padre.txId + '-' + Date.toSapDate() + (dump ? '.dump' : '.log')
	}

}



class LogTransmision {

	transmision;
	#registros;
	#prefijo;

	constructor(transmision, prefijo = '') {
		this.transmision = transmision;
		this.#registros = [];
		this.#prefijo = prefijo;
	}

	get registros() {
		return this.#registros;
	}

	get prefijo() {
		return this.#prefijo;
	}

	get txId() {
		return this.transmision.txId;
	}

	#grabarEntrada(datos, nivel) {
		let registro = new RegistroLogTransmision(datos, nivel, this)
		this.#registros.push(registro);
	}

	dump(...datos) {
		new RegistroDumpTransmision(datos, this)
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