'use strict';
//const C = global.config;
//const L = global.logger;
//const K = global.constants;
//const M = global.mongodb;


/**
 * Representa el resultado final del procesamiento de una transmisión.
 * - codigoEstadoHttp:			(Numeric) El código de respuesta HTTP que corresponde al estado actual de la transmisión
 * - codigoEstadoTransmision:	(Numeric) El estado de la transmisión que corresponde al estado actual de la transmisión
 * - cuerpoRespuestaHttp:		(Object)  La respuesta que hay que darle al cliente en el estado actual de la transmisión
*/
class ResultadoTransmision {
	codigoEstadoHttp;
	codigoEstadoTransmision;
	cuerpoRespuestaHttp;
	

	constructor(codigoEstadoHttp, codigoEstadoTransmision, cuerpoRespuestaHttp) {
		this.codigoEstadoHttp = codigoEstadoHttp;
		this.codigoEstadoTransmision = codigoEstadoTransmision;
		this.cuerpoRespuestaHttp = cuerpoRespuestaHttp;
	}

	async cerrarTransmision(transmision) {
		await transmision.responder(this.cuerpoRespuestaHttp, this.codigoEstadoHttp);
		transmision.setEstado(this.codigoEstadoTransmision);
		await transmision.actualizarTransmision();
	}
}

module.exports = ResultadoTransmision;