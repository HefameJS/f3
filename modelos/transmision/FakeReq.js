'use strict';

const Token = require("./Token");

const K = global.K;

class FakeReq {

	constructor(conexion) {
		Object.assign(this, conexion.solicitud);
		this.originalUrl = this.url;

		this.ip = 'no-aplica';
		this.headers['software-id'] = K.SOFTWARE_ID.RETRANSMISOR;
		this.headers['x-balanceador'] = 'no-aplica';
		this.headers['x-ssl-protocol'] = 'no-aplica';
		this.headers['x-ssl-cipher'] = 'no-aplica';

		// Hay que generar un token como el original, pero que no esté caducado
		this.headers['authorization'] = 'Bearer ' + Token.generarToken(conexion.metadatos.autenticacion.usuario, conexion.metadatos.autenticacion.dominio);
	}

	getHeaders() {
		return this.headers;
	}

}

module.exports = FakeReq;