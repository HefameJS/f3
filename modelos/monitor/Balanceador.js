'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;


const OS = require('os');
const axios = require('axios');
const { URLSearchParams } = require('url');





class MatchEnlace {

	constructor(match) {
		/**
		
		<td><a href="/balancer-manager?b=sapt01&amp;w=http://sap1t01:8000&amp;nonce=26887741-cf60-3869-1ac3-ef42298b258f">http://sap1t01:8000</a></td><td></td><td></td><td>1</td><td>0</td><td>Init Ok </td><td>5551</td><td>0</td><td>1</td><td> 12232M</td><td>1123118M</td>
					 ---------------------------------------------------------------------------------------------------  -------------------             -        -        -         -         --------         ----         -         -         -------         --------
					 1: URL (de aqui extraeremos w (worker), b (balancer) y nonce)				 						  2: Ignorado					  3        4		5:factor  6:conjut  7:estado         8:n_elegido  9:busy    10:load   11:entrada(MB)  12:salida(MB)                                            
					 
		for <a href="/balancer-manager?b=sapt01&amp;nonce=26887741-cf60-3869-1ac3-ef42298b258f">balancer://sapt01</a>
					 -------------------------------------------------------------------------  -----------------
					 14: URL (de aqui extraeremos b (balancer) y nonce)                         15: Ignorado
		*/


		// Si el match 14 existe, es el caso balanceador y contiene la URL del balanceador
		// en caso contrario, es el caso worker, y la URL viene en el match 1
		if (match[14]) {

			this.url = new URL('http://dummy' + match[14].replace(/&amp;/g, '&'));
		} else {
			this.url = new URL('http://dummy' + match[1].replace(/&amp;/g, '&'));
		}

		// Los matchs del 3 al 12 son las estadisticas del worker.
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
		// Si tiene el parametro 'w' (worker) es que NO es un enlace de cabecera de balanceador
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


class BalanceadorApache {
	constructor(enlace) {
		this.nombre = enlace.getNombreBalanceador();
		this.nonce = enlace.getNonce();
		this.workers = [];
	}

	addDestino(destino) {
		this.workers.push(destino);
	}
}

class WorkerApache {
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

const _analizaDatosBalanceadores = (data) => {

	/**
	 * Esta REGEX tiene dos partes:
	 * La que busca las líneas con los enlaces de los diferentes Workers, del estilo:
	 * 	- <td><a href="/balancer-manager?b=sapt01&amp;w=http://sap1t01:8000&amp;nonce=26887741-cf60-3869-1ac3-ef42298b258f">http://sap1t01:8000</a></td><td></td><td></td><td>1</td><td>0</td><td>Init Ok </td><td>5551</td><td>0</td><td>1</td><td> 32M</td><td>118M</td>
	 * La que busca las cabeceras de los balanceadores, del estilo:
	 *  - for <a href="/balancer-manager?b=sapt01&amp;nonce=26887741-cf60-3869-1ac3-ef42298b258f">balancer://sapt01</a>
	 */
	let regex = /<td><a href=\"([a-z0-9\/\-?=&;:]+)\">([a-z0-9\/\-?=&;:]+)<\/a><\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td><td>([0-9a-z\-\.\s]*)<\/td>|(for <a href=\")([a-z0-9\/\-?=&;:]+)(\">)/gmi;
	let balanceadores = {}
	let match = regex.exec(data);
	while (match != null) {

		let enlace = new MatchEnlace(match)

		if (enlace.isBalanceador()) {
			balanceadores[enlace.getNombreBalanceador()] = new BalanceadorApache(enlace);
		} else {
			balanceadores[enlace.getNombreBalanceador()].addDestino(new WorkerApache(enlace));
		}

		match = regex.exec(data);
	}
	return balanceadores
}





class Balanceador {

	constructor(datos) {
		this.nombre = datos.nombre;
		this.base = datos.base;
		this.proxy = datos.proxy;
		this.tipo = datos.tipo;
	}

	#esLocal() {
		if (!this.proxy) return true;
		return OS.hostname().toLowerCase() === this.proxy;
	}

	async consultaEstado() {

		if (this.#esLocal()) {

			let parametrosLlamada = {
				url: this.base + '/balancer-manager',
				headers: {
					referer: this.base + '/balancer-manager',
				}
			}

			let respuesta = await axios(parametrosLlamada);
			let cuerpoHttp = respuesta.data;
			return {
				nombre: this.nombre,
				url: this.base,
				tipo: this.tipo,
				proxy: this.proxy,
				balanceadores: _analizaDatosBalanceadores(cuerpoHttp)
			}

		} else {
			const iMonitor = require('interfaces/iMonitor');
			return await iMonitor.llamadaMonitorRemoto(this.proxy, '/v1/balanceadores/' + this.nombre)
		}

	}

	async actualizarEstado(grupoBalanceo, worker, estado = {}, peso = "1") {

		if (this.#esLocal()) {

			let estadoActual = await this.consultaEstado();
			let nonce = estadoActual?.balanceadores?.[grupoBalanceo]?.nonce;

			if (!nonce) {
				global.logger.e( ['No se encontro el nonce para el grupo de balanceo', grupoBalanceo, estadoActual] );
				throw new Error('Imposible encontrar el nonce para el grupo de balanceo');
			}

			let urlEncodedParams = new URLSearchParams();
			urlEncodedParams.append("w_lf", peso);
			//urlEncodedParams.append("w_ls", "0");
			//urlEncodedParams.append("w_wr", "");
			//urlEncodedParams.append("w_rr", "");
			urlEncodedParams.append("w_status_I", (estado.ignoreError ? "1" : "0"));
			urlEncodedParams.append("w_status_N", (estado.draining ? "1" : "0"));
			urlEncodedParams.append("w_status_D", (estado.disabled ? "1" : "0"));
			urlEncodedParams.append("w_status_H", (estado.standby ? "1" : "0"));
			urlEncodedParams.append("w_status_S", (estado.stop ? "1" : "0"));
			urlEncodedParams.append("w", worker);
			urlEncodedParams.append("b", grupoBalanceo);
			urlEncodedParams.append("nonce", nonce);

			let parametrosLlamada = {
				url: this.base + '/balancer-manager',
				method: 'POST',
				headers: {
					referer: this.base + '/balancer-manager'
				},
				data: urlEncodedParams.toString()
				
			}

			let respuesta = await axios(parametrosLlamada);


			let cuerpoHttp = respuesta.data;
			return {
				nombre: this.nombre,
				url: this.base,
				tipo: this.tipo,
				proxy: this.proxy,
				balanceadores: _analizaDatosBalanceadores(cuerpoHttp)
			}
		}
		return null;
	}


}

module.exports = Balanceador;