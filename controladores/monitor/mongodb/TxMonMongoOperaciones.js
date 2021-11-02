'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');

class TxMonMongoOperaciones extends TransmisionLigera {

	// @Override
	async operar() {
		this.log.info('Solicitud del estado MongoDB - Operaciones');
		try {
			let adminDB = M.getBD('admin');
			let operaciones = await adminDB.command({ currentOp: true, "$all": true, "active": true });

			let resultado = operaciones.inprog.filter(op => op?.clientMetadata?.driver?.name === 'nodejs')
				.map(op => {
					return {
						id: op.connectionId,
						operacion: op.op,
						servidor: op.host,
						cliente: op.client,
						aplicacion: op.appName,
						activo: op.active,
						fechaOperacion: op.currentOpTime,
						usuario: op.effectiveUsers?.[0]?.user,
						db: op.effectiveUsers?.[0]?.db,
					};
				})

			return new ResultadoTransmisionLigera(200, resultado);
		} catch (errorMongo) {
			this.log.err('Error al obtener las operaciones del clúster', errorMongo);
			return (new ErrorFedicom(errorMongo)).generarResultadoTransmision();
		}
	}
}


TxMonMongoOperaciones.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonMongoOperaciones;