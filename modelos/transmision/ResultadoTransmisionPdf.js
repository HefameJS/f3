'use strict';

const ResultadoTransmision = require("./ResultadoTransmision");

/**
 * Representa el resultado final del procesamiento de una transmisión que va a devolver un PDF al cliente.
 * - codigoEstadoHttp:			(Numeric) El código de respuesta HTTP que corresponde al estado actual de la transmisión
 * - codigoEstadoTransmision:	(Numeric) El estado de la transmisión que corresponde al estado actual de la transmisión
 * - cuerpoRespuestaHttp:		(Buffer) La respuesta que hay que darle al cliente en el estado actual de la transmisión
 * - nombreFichero				(string) El nombre del fichero PDF que se envía
*/
class ResultadoTransmisionPdf extends ResultadoTransmision {

	nombreFichero;

	constructor(codigoEstadoHttp, codigoEstadoTransmision, cuerpoRespuestaHttp, nombreFichero) {
		super(codigoEstadoHttp, codigoEstadoTransmision, cuerpoRespuestaHttp)
		this.nombreFichero = nombreFichero;
	}

	// @Override
	async responderTransmision(transmision) {
		await transmision.responder(this.cuerpoRespuestaHttp, this.codigoEstadoHttp, 'application/pdf', this.nombreFichero);
		transmision.setEstado(this.codigoEstadoTransmision);
	}
}

module.exports = ResultadoTransmisionPdf;