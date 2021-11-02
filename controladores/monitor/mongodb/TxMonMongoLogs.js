'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

class TxMonMongoLogs extends TransmisionLigera {

	// @Override
	async operar() {

		// tipoLog = * | global | startupWarnings

		let tipoLog = this.req.params.tipoLog || '*';

		this.log.info(`MongoDB: Obtener Logs [tipoLog=${tipoLog}]`);

		try {
			let logs = await M.getBD('admin').command({ getLog: tipoLog });
			if (logs.names) return new ResultadoTransmisionLigera(200, logs.names);

			logs = logs.log
				.map(l => {
					let json = JSON.parse(l);
					return {
						fecha: json.t['$date'],
						nivel: json.s,
						tipo: json.c,
						mensaje: json.msg + (json.attr?.message ? ' - ' + json.attr.message : ''),
						cliente: json.attr?.remote,
						usuario: json.attr?.principalName,
						aplicacion: json.attr?.doc?.application?.name
					}
				})
				.filter(l => l.mensaje !== "client metadata")
				.sort((a, b) => a.fecha < b.fecha ? 1 : -1);

			return new ResultadoTransmisionLigera(200, logs);
		} catch (errorMongo) {
			this.log.err('Error al obtener los logs de la base de datos', errorMongo);
			return (new ErrorFedicom(errorMongo)).generarResultadoTransmision();
		}
	}


}


TxMonMongoLogs.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonMongoLogs;