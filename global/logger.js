'use strict';
let C = global.config;
//const L = {};
//const K = global.constants;


const util = require('util');
const fs = require('fs');

const TRACE = 'TRC';
const DEBUG = 'DBG';
const INFO = 'INF';
const WARN = 'WRN';
const ERROR = 'ERR';
const FATAL = 'DIE';
const EVENT = 'EVT';


class Evento {
	constructor({ nivel, categoria, datos, txId }) {

		this.nivel = nivel ?? INFO;
		this.categoria = categoria.padStart ? categoria.padStart(15) : '';
		this.datos = Array.isArray(datos) ? datos : [datos];
		this.timestamp = new Date();
		this.txId = txId ?? null;
		this.proceso = {
			iid: process.iid
		}
		if (process.worker) this.proceso.worker = process.worker;
	}
}

class Logger {

	constructor() {

	}

	#generarNombreFichero(dump = false) {
		return C.log.directorio + process.titulo + '-' + process.iid + '-' + Date.toSapDate() + (dump ? '.dump' : '.log')
	}

	grabarLog(evento) {

		C = global.config;
		let hora = Date.toShortTime(evento.timestamp);
		let mensaje = (evento.txId ? evento.txId + '|' : '') + hora + '|' + evento.nivel + '|' + evento.categoria + '|' + JSON.stringify(evento.datos)
		
		fs.appendFile(this.#generarNombreFichero(), mensaje + '\n', (err) => {
			if (err) {
				console.log(mensaje)
				console.log('###', err)
			}
		})

		if (C.log.consola) {
			if (evento.nivel === ERROR || evento.nivel === FATAL)
				console.log('\u001b[' + 30 + 'm' + '\u001b[' + 41 + 'm' + (process.titulo || 'init') + '|' + mensaje + '\u001b[0m');
			else if (evento.nivel === WARN)
				console.log('\u001b[' + 30 + 'm' + '\u001b[' + 43 + 'm' + (process.titulo || 'init') + '|' + mensaje + '\u001b[0m');
			else if (evento.nivel === DEBUG || evento.nivel === TRACE)
				console.log('\u001b[' + 36 + 'm' + (process.titulo || 'init') + '|' + mensaje + '\u001b[0m');
			else
				console.log((process.titulo || 'init') + '|' + mensaje);
		}

	}

	logGeneral(datos, nivel, categoria) {
		categoria = categoria || 'server';
		let evento = new Evento({ nivel, datos, categoria })
		this.grabarLog(evento);
	};

	logTransmision(txId, datos, nivel, categoria) {
		categoria = categoria || 'tx';
		let evento = new Evento({ nivel, datos, categoria, txId })
		this.grabarLog(evento);
	};

	logEvento(txId, txTipo, txEstado, datos) {

		let evento = new Evento({
			nivel: EVENT,
			datos: {
				datos: datos,
				tipo: txTipo,
				estado: txEstado
			},
			categoria: 'evento',
			txId
		});

		this.grabarLog(evento);
	}

	logDump(err, req) {

		C = global.config;
		
		let message = (new Date).toUTCString() + '\n\n'
		message += err.stack

		if (req) {
			message += '\n\nPETICIÓN HTTP\n=============\n'
			message += 'IP: ' + req.ip + ' (' + req.protocol + ')\n'
			message += req.method + ' ' + req.originalUrl + ' HTTP/' + req.httpVersion + '\n'
			message += util.inspect(req.headers) + '\n\n'
			message += util.inspect(req.body)
		}

		fs.appendFileSync(this.#generarNombreFichero(true), message, (err) => {
			if (err) {
				console.error(message)
				console.error('###', err)
			}
		})

		if (C.log.consola) {
			console.log('DUMP GENERADO')
			console.log(message)
		}

	}

	t(datos, categoria) {
		this.logGeneral(datos, TRACE, categoria);
	}

	d(datos, categoria) {
		this.logGeneral(datos, DEBUG, categoria);
	}

	i(datos, categoria) {
		this.logGeneral(datos, INFO, categoria);
	}

	w(datos, categoria) {
		this.logGeneral(datos, WARN, categoria);
	}

	e(datos, categoria) {
		this.logGeneral(datos, ERROR, categoria);
	}

	f(datos, categoria) {
		this.logGeneral(datos, FATAL, categoria);
	}

	xt(id, datos, categoria) {
		this.logTransmision(id, datos, TRACE, categoria);
	}

	xd(id, datos, categoria) {
		this.logTransmision(id, datos, DEBUG, categoria);
	}

	xi(id, datos, categoria) {
		this.logTransmision(id, datos, INFO, categoria);
	}

	xw(id, datos, categoria) {
		this.logTransmision(id, datos, WARN, categoria);
	}

	xe(id, datos, categoria) {
		this.logTransmision(id, datos, ERROR, categoria);
	}

	xf(id, datos, categoria) {
		this.logTransmision(id, datos, FATAL, categoria);
	}

	evento(txId, txTipo, txEstado, datos) {
		this.logEvento(txId, txTipo, txEstado, datos);
	}

	dump(err, req) {
		this.logDump(err, req);
	}

}


const L = new Logger();

module.exports = L;
