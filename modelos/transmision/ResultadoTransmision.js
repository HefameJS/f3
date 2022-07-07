'use strict';

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

	/**
	 * ***INTERNO***
	 * Función para uso interno dentro del flujo de ejecución de cualquier transmisión.
	 * @param {*} transmision 
	 */
	async responderTransmision(transmision) {
		await transmision.responder(this.cuerpoRespuestaHttp, this.codigoEstadoHttp);
		transmision.setEstado(this.codigoEstadoTransmision);
	}
}

module.exports = ResultadoTransmision;