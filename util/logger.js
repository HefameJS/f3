'use strict';
// const BASE = global.BASE;
const C = global.config;
var L = {};
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


const getLogFile = (timestamp, dump) => {
	let fecha = Date.toShortDate(timestamp)
	if (dump) fecha += '.' + Date.toShortTime(timestamp)
	return logDir + '/' + fecha + '-' + process.title + '-' + process.pid + (dump ? '.dump' : '.log')
}

const grabarLog = (event) => {

	let txId = event.tx
	let categoria = event.categoria.padStart(15)

	let hora = Date.toShortTime(event.timestamp)
	
	let message = (txId ? txId + '|' : '') + hora + '|' + event.level + '|' + categoria + '|' + JSON.stringify(event.datos)

	fs.appendFile(getLogFile(event.timestamp), message + '\n', (err) => {
		if (err) {
			console.log(message)
			console.log('###',err)
		}
	})

	if (C.logconsole) {
		console.log(message)
	}

}

const logGeneral = (datos, level, categoria) => {
	if (!Array.isArray(datos)) datos = [datos];

	var event = {
		categoria: categoria || 'server',
		level: level || INFO,
		datos: datos,
		timestamp: new Date()
	}
	grabarLog(event);
};

const logTransmision = (id, datos, level, categoria) => {
	if (!Array.isArray(datos)) datos = [datos];

	var event = {
		tx: id,
		categoria: categoria || 'tx',
		level: level || 5000,
		datos: datos,
		timestamp: new Date()
	};
	grabarLog(event);
};
/*
const saneaEstructuraDeCommit = (datos) => {
	return {
		setOnInsert: datos['$setOnInsert'],
		max: datos['$max'],
		set: datos['$set'],
		push: datos['$push']
	}
}
*/
const logEvento = (txId, txType, txStat, datos) => {
	/*
	if (!Array.isArray(datos)) datos = [datos];

	var event = {
		tx: txId,
		categoria: 'evento',
		level: EVENT,
		txType: txType,
		txStatus: txStat,
		datos: [txType, txStat, ...datos],
		timestamp: new Date()
	};
	*/
	// grabarLog(event);
}


const dump = (err, req) => {

	let message = (new Date).toUTCString() + '\n\n'
	message += err.stack


	if (req) {
		message += '\n\nPETICIÓN HTTP\n=============\n'
		message += 'IP: ' + req.ip + ' (' + req.protocol +  ')\n'
		message += req.method + ' ' + req.originalUrl + ' HTTP/' + req.httpVersion + '\n'
		message += util.inspect(req.headers) + '\n\n',
		message += util.inspect(req.body)
	}

	fs.appendFileSync(getLogFile(new Date(), true), message, (err) => {
		if (err) {
			console.error(message)
			console.error('###', err)
		}
	})

	if (C.logconsole) {
		console.log('DUMP GENERADO: ' + getLogFile(new Date(), true))
		console.log(message)
	}
	
}


var generaCategoriaLog = (categoria) => categoria;

switch (process.title) {
	case K.PROCESS_TITLES.WATCHDOG:
		generaCategoriaLog = (categoria) => categoria ? 'wd-' + categoria : 'watchdog';
		break;
	case K.PROCESS_TITLES.MONITOR:
		generaCategoriaLog = (categoria) => categoria ? 'mon-' + categoria : 'monitor';
		break;
}



L = {
	t: (datos, categoria) => logGeneral(datos, TRACE, generaCategoriaLog(categoria)),
	d: (datos, categoria) => logGeneral(datos, DEBUG, generaCategoriaLog(categoria)),
	i: (datos, categoria) => logGeneral(datos, INFO, generaCategoriaLog(categoria)),
	w: (datos, categoria) => logGeneral(datos, WARN, generaCategoriaLog(categoria)),
	e: (datos, categoria) => logGeneral(datos, ERROR, generaCategoriaLog(categoria)),
	f: (datos, categoria) => logGeneral(datos, FATAL, generaCategoriaLog(categoria)),
	xt: (id, datos, categoria) => logTransmision(id, datos, TRACE, generaCategoriaLog(categoria)),
	xd: (id, datos, categoria) => logTransmision(id, datos, DEBUG, generaCategoriaLog(categoria)),
	xi: (id, datos, categoria) => logTransmision(id, datos, INFO, generaCategoriaLog(categoria)),
	xw: (id, datos, categoria) => logTransmision(id, datos, WARN, generaCategoriaLog(categoria)),
	xe: (id, datos, categoria) => logTransmision(id, datos, ERROR, generaCategoriaLog(categoria)),
	xf: (id, datos, categoria) => logTransmision(id, datos, FATAL, generaCategoriaLog(categoria)),
	yell: logEvento,
	dump: dump
	/*saneaCommit: saneaEstructuraDeCommit*/
};


module.exports = L;
