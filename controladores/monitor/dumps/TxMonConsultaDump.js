'use strict';
const M = global.M;
const fs = require('fs/promises');
const path = require('path');
const SEPARADOR_DIRECTORIOS = path.sep;

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');


const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const InterComunicador = require('interfaces/InterComunicador');




class TxMonConsultaDump extends TransmisionLigera {

	// @Override
	async operar() {

		let servidor = this.req.params?.servidor?.toLowerCase()
		let idDump = this.req.params?.idDump


		if (!servidor) {// Consulta general de todos los dumps del sistema
			this.log.info(`Solicitud del listado de Dumps del sistema`);
			let interComunicador = new InterComunicador(this);
			let respuesta = await interComunicador.llamadaTodosMonitores(`/~/dumps/local`)
			return new ResultadoTransmisionLigera(200, respuesta);
		}
		else {

			if (servidor !== 'local' && servidor !== K.HOSTNAME) {
				this.log.info(`La solicitud es para el servidor ${servidor}. Redirigimos la petición al mismo`);
				let interComunicador = new InterComunicador(this);
				let respuesta = await interComunicador.llamadaMonitorRemoto(servidor, `/~/dumps/local${idDump ? '/' + idDump : ''}`)
				return new ResultadoTransmisionLigera(200, respuesta);
			}

			if (idDump) {// Consulta de un DUMP en concreto
				this.log.info(`Solicitud del Dump [servidor=${servidor}, dump=${idDump}]`);

				return new ResultadoTransmisionLigera(200, { dump: "dummy" });
			} else {// Consulta de todos los dumps de un servidor
				this.log.info(`Solicitud del listado de Dumps del servidor [servidor=${servidor}, dump=${idDump}]`);

				return new ResultadoTransmisionLigera(200, { dumps: [1, 2, 3] });
			}
		}

	}

}


TxMonConsultaDump.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaDump;