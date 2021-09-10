'use strict';

const ResultadoTransmision = require("./ResultadoTransmision");

/**
 * Representa el resultado final del procesamiento de una transmisión ligera.
 * - codigoEstadoHttp:			(Numeric) El código de respuesta HTTP que corresponde al estado actual de la transmisión
 * - cuerpoRespuestaHttp:		(Object)  La respuesta que hay que darle al cliente en el estado actual de la transmisión
*/
class ResultadoTransmisionLigera extends ResultadoTransmision {

	constructor(codigoEstadoHttp, cuerpoRespuestaHttp) {
		super(codigoEstadoHttp, null, cuerpoRespuestaHttp)
	}

	// Override
	async responderTransmision(transmision) {
		await transmision.responder(this.cuerpoRespuestaHttp, this.codigoEstadoHttp);
	}
}

module.exports = ResultadoTransmisionLigera;