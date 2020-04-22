'use strict';
//const BASE = global.BASE;
//const C = global.config;
const L = global.logger;
//const K = global.constants;

const request = require('request');

class MatchEnlace {
	constructor(match) {
		if (match[14])
			this.url = new URL('http://dummy' + match[14].replace(/&amp;/g, '&'));
		else
			this.url = new URL('http://dummy' + match[1].replace(/&amp;/g, '&'));

		let i = 3;
		this.extra = {
			route: match[i++],
			routeRedir: match[i++],
			factor: match[i++],
			set: match[i++],
			status: match[i++],
			elected: match[i++],
			busy: match[i++],
			load: match[i++],
			to: match[i++],
			from: match[i++],
		}
	}

	isBalanceador() {
		return this.url.searchParams.has('w') ? false : true;
	}

	getNombreBalanceador() {
		return this.url.searchParams.get('b');
	}
	getNonce() {
		return this.url.searchParams.get('nonce');
	}

	getDestino() {
		return this.url.searchParams.get('w');
	}

	getExtra() {
		return this.extra;
	}
}

class Balanceador {
	constructor(enlace) {
		this.nombre = enlace.getNombreBalanceador();
		this.nonce = enlace.getNonce();
		this.workers = [];
	}

	addDestino(destino) {
		this.workers.push(destino);
	}
}


class Worker {
	constructor(enlace) {
		this.nombre = enlace.getDestino();
		let extra = enlace.getExtra();

		this.peso = parseInt(extra.factor);
		this.vecesElegido = parseInt(extra.elected);
		this.enviado = extra.to;
		this.recibido = extra.from;
		this.estado = {
			ignoraErrores: /Ign/.test(extra.status),
			drenando: /Drn/.test(extra.status),
			deshabilitado: /Dis/.test(extra.status),
			parado: /Stop/.test(extra.status),
			standby: /Stby/.test(extra.status),
			ok: /Ok/.test(extra.status),
			error: /Err/.test(extra.status)
		}

	}
}


const parseDataToBalanceadores = (data) => {
	let regex = /<td><a href=\"([a-z0-9\/\-?=&;:]+)\">([a-z0-9\/\-?=&;:]+)<\/a><\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td>|(for <a href=\")([a-z0-9\/\-?=&;:]+)(\">)/gmi;
	let balanceadores = {}
	let match = regex.exec(data);
	while (match != null) {

		let enlace = new MatchEnlace(match)

		if (enlace.isBalanceador()) {
			balanceadores[enlace.getNombreBalanceador()] = new Balanceador(enlace);
		} else {
			balanceadores[enlace.getNombreBalanceador()].addDestino(new Worker(enlace));
		}

		match = regex.exec(data);
	}
	return balanceadores
}


const getBalanceadores = (servidor, callback) => {

	let parametrosLlamada = {
		followAllRedirects: true,
		uri: servidor + '/balancer-manager',
		headers: {
			referer: servidor + '/balancer-manager',
		}
	}

	L.i(["Consultando balanceadores del servidor", servidor])

	request(parametrosLlamada, (errorLlamada, respuestaHttp, cuerpoHttp) => {

		if (errorLlamada) {
			callback(errorLlamada, null);
			return;
		}

		if (respuestaHttp.statusCode !== 200) {
			callback({
				errno: respuestaHttp.statusCode,
			}, null);
			return;
		}

		callback(null, parseDataToBalanceadores(cuerpoHttp));

	});
}


const actualizarWorker = (servidor, balanceador, worker, nonce, estado, loadFactor, callback) => {

	if (!estado) estador = {}
	if (!loadFactor) loadFactor = "1"

	let urlencoded = new URLSearchParams();
	urlencoded.append("w_lf", loadFactor);
	//urlencoded.append("w_ls", "0");
	//urlencoded.append("w_wr", "");
	//urlencoded.append("w_rr", "");
	//urlencoded.append("w_status_I", "0");
	//urlencoded.append("w_status_N", "0");
	//urlencoded.append("w_status_D", "0");
	urlencoded.append("w_status_H", (estado.standby ? "1" : "0"));
	urlencoded.append("w_status_S", (estado.stop ? "1" : "0"));
	urlencoded.append("w", worker);
	urlencoded.append("b", balanceador);
	urlencoded.append("nonce", nonce);

	let parametrosLlamada = {
		followAllRedirects: true,
		uri: servidor + '/balancer-manager',
		method: 'POST',
		headers: {
			referer: servidor + '/balancer-manager',
		},
		body: urlencoded.toString()
	}

	L.i(["Actualizando worker del balanceador del servidor", servidor, urlencoded])

	request(parametrosLlamada, (errorLlamada, respuestaHttp, cuerpoHttp) => {

		if (errorLlamada) {
			callback(errorLlamada, null);
			return;
		}

		if (respuestaHttp.statusCode !== 200) {
			callback({
				errno: respuestaHttp.statusCode,
			}, null);
			return;
		}

		callback(null, parseDataToBalanceadores(cuerpoHttp));

	});
}

module.exports = {
	getBalanceadores,
	actualizarWorker
}