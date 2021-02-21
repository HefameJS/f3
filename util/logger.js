'use strict';
const C = global.config;
let L = {};
const K = global.constants;

const fs = require('fs');
const logDir = C.logdir || '.'
const util = require('util');


const TRACE = 'TRC'
const DEBUG = 'DBG'
const INFO = 'INF'
const WARN = 'WRN'
const ERROR = 'ERR'
const FATAL = 'DIE'
const EVENT = 'EVT'


const _obtenerFicheroLog = (timestamp, esParaDump) => {
	let fecha = Date.toShortDate(timestamp)
	if (esParaDump) fecha += '.' + Date.toShortTime(timestamp)
	return logDir + '/' + fecha + '-' + process.title + '-' + process.pid + (esParaDump ? '.dump' : '.log')
}

const grabarLog = (evento) => {

	let txId = evento.tx
	let categoria = evento.categoria && evento.categoria.padStart ? evento.categoria.padStart(15) : evento.categoria;

	let hora = Date.toShortTime(evento.timestamp)

	let mensaje = (txId ? txId + '|' : '') + hora + '|' + evento.level + '|' + categoria + '|' + JSON.stringify(evento.datos)

	/*fs.appendFile(_obtenerFicheroLog(evento.timestamp), mensaje + '\n', (err) => {
		if (err) {
			console.log(mensaje)
			console.log('###', err)
		}
	})*/

	if (C.logconsole) {
		console.log(mensaje)
	}

}

const logGeneral = (datos, nivel, categoria) => {
	if (!Array.isArray(datos)) datos = [datos];

	let evento = {
		categoria: categoria || 'server',
		level: nivel || INFO,
		datos: datos,
		timestamp: new Date()
	}
	grabarLog(evento);
};

const logTransmision = (txId, datos, nivel, categoria) => {
	if (!Array.isArray(datos)) datos = [datos];

	let evento = {
		tx: txId,
		categoria: categoria || 'tx',
		level: nivel || 5000,
		datos: datos,
		timestamp: new Date()
	};
	grabarLog(evento);
};


const logEvento = (txId, txType, txStat, datos) => {
	if (!Array.isArray(datos)) datos = [datos];

	let evento = {
		tx: txId,
		categoria: 'evento',
		level: EVENT,
		txType: txType,
		txStatus: txStat,
		datos: datos,
		timestamp: new Date()
	};
	
	grabarLog(evento);
}


const dump = (err, req) => {

	let message = (new Date).toUTCString() + '\n\n'
	message += err.stack


	if (req) {
		message += '\n\nPETICIÓN HTTP\n=============\n'
		message += 'IP: ' + req.ip + ' (' + req.protocol + ')\n'
		message += req.method + ' ' + req.originalUrl + ' HTTP/' + req.httpVersion + '\n'
		message += util.inspect(req.headers) + '\n\n'
		message += util.inspect(req.body)
	}

	/*fs.appendFileSync(_obtenerFicheroLog(new Date(), true), message, (err) => {
		if (err) {
			console.error(message)
			console.error('###', err)
		}
	})*/

	if (C.logconsole) {
		console.log('DUMP GENERADO: ' + _obtenerFicheroLog(new Date(), true))
		console.log(message)
	}

}


let _generaCategoriaLog = (categoria) => categoria;
switch (process.title) {
	case K.PROCESS_TITLES.WATCHDOG:
		_generaCategoriaLog = (categoria) => categoria ? 'wd-' + categoria : 'watchdog';
		break;
	case K.PROCESS_TITLES.MONITOR:
		_generaCategoriaLog = (categoria) => categoria ? 'mon-' + categoria : 'monitor';
		break;
}



L = {
	t: (datos, categoria) => logGeneral(datos, TRACE, _generaCategoriaLog(categoria)),
	d: (datos, categoria) => logGeneral(datos, DEBUG, _generaCategoriaLog(categoria)),
	i: (datos, categoria) => logGeneral(datos, INFO, _generaCategoriaLog(categoria)),
	w: (datos, categoria) => logGeneral(datos, WARN, _generaCategoriaLog(categoria)),
	e: (datos, categoria) => logGeneral(datos, ERROR, _generaCategoriaLog(categoria)),
	f: (datos, categoria) => logGeneral(datos, FATAL, _generaCategoriaLog(categoria)),
	xt: (id, datos, categoria) => logTransmision(id, datos, TRACE, _generaCategoriaLog(categoria)),
	xd: (id, datos, categoria) => logTransmision(id, datos, DEBUG, _generaCategoriaLog(categoria)),
	xi: (id, datos, categoria) => logTransmision(id, datos, INFO, _generaCategoriaLog(categoria)),
	xw: (id, datos, categoria) => logTransmision(id, datos, WARN, _generaCategoriaLog(categoria)),
	xe: (id, datos, categoria) => logTransmision(id, datos, ERROR, _generaCategoriaLog(categoria)),
	xf: (id, datos, categoria) => logTransmision(id, datos, FATAL, _generaCategoriaLog(categoria)),
	evento: logEvento,
	dump: dump
};


module.exports = L;
