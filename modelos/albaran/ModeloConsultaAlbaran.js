'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;


class FiltroCampo {
	constructor(sign, option, low, high) {
		this.sign = sign || 'I';
		this.option = option || 'EQ';
		this.low = low || '';
		if (high !== undefined)
			this.high = high || '';
	}
}


class ConsultaAlbaran {

	constructor(codigoCliente) { 
		this.no_all_pto = ' ';
		this.only_yvcab = 'X';

		this.result_per_page = 20;
		this.view_page = 1;
		this._offset = 0;
		this.max_result = 0;
		this.campos = {};
		this.campos['r_kunnr'] = new FiltroCampo('I','EQ',codigoCliente);
		// this.campos['r_prof'] = new FiltroCampo('E', 'EQ', '');
	}

	mostrarSoloConProforma(flag) {
		if (flag) this.only_yvcab = ' ';
		else this.only_yvcab = 'X';
	}

	mostrarPuntoEntrega(flag) {
		if (flag) this.no_all_pto = ' ';
		else this.no_all_pto = 'X';
	}

	setOffset(offset) {
		this._offset = offset;
		this.view_page = Math.floor(this._offset  / this.result_per_page) + 1;
		return this;
	}

	setLimit(limit) {
		this.result_per_page = limit;
		this.view_page = Math.floor(this._offset / this.result_per_page) + 1;
		return this;
	}

	setFechas(inicio, fin) {

		if (!fin) {
			fin = new Date();
		}

		if (!inicio) {
			inicio = new Date(new Date(fin).setFullYear(fin.getFullYear() - 1))
		}
		
		this.campos['r_erdat'] = new FiltroCampo('I', 'BT', Date.toSapDate(inicio), Date.toSapDate(fin));
		return this;
	}

	setNumeroPedidoOrigen(numeroPedidoOrigen, crc) {
		if (crc && crc.length >= 8) {
			crc = crc.substring(0, 8)
			numeroPedidoOrigen = numeroPedidoOrigen.padEnd(12, ' ');
			this.campos['r_bstkd'] = new FiltroCampo('I', 'EQ', numeroPedidoOrigen + crc);
		}
		return this;
	}

	setCrc(numeroPedido) {
		if (numeroPedido && numeroPedido.length >= 8) {
			let crc = numeroPedido.substring(0, 8)
			this.campos['r_bstkd'] = new FiltroCampo('I', 'CP', '*' + crc);
		}
		return this;
	}

	setNumeroAlbaran(numeroAlbaran) {
		this.campos['r_vbeln'] = new FiltroCampo('I', 'EQ', numeroAlbaran);
	}


	toQueryObject() {
		let root = {}
		root.no_all_pto = this.no_all_pto;
		root.only_yvcab = this.only_yvcab;

		root.result_per_page = this.result_per_page;
		root.view_page = this.view_page;
		root.max_result = this.max_result;

		for(let campo in this.campos) {
			root[campo] = [this.campos[campo]]
		}
		
		return root;
	}

	toQueryString() {
		return JSON.stringify(this.toQueryObject());
	}


}


module.exports = ConsultaAlbaran;