'use strict';
const M = global.M;
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonConsultarCacheUsuarios extends TransmisionLigera {

	// @Override
	async operar() {

		let idUsuario = this.req.params.idUsuario || null;
		let resultadoMongo = null;
		try {
			if (idUsuario) {
				this.log.info(`Consultando datos de caché para el usuario ${idUsuario}`);
				resultadoMongo = await M.col.cacheUsuarios.findOne({ _id: idUsuario }, { projection: { _id: 1, fechaCacheo: 1 } });
				if (resultadoMongo) {
					return new ResultadoTransmisionLigera(200, {
						usuario: resultadoMongo._id,
						fechaCacheo: resultadoMongo.fechaCacheo
					});
				} else {
					return new ResultadoTransmisionLigera(200, {
						usuario: null,
						fechaCacheo: null
					});
				}
			} else {
				this.log.info(`Consultando cantidad de entradas en caché de credenciales`);
				resultadoMongo = await M.col.cacheUsuarios.count({});
				return new ResultadoTransmisionLigera(200, {
					entradas: resultadoMongo
				});
			}

		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonConsultarCacheUsuarios.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_INSTANCIAS'
});


module.exports = TxMonConsultarCacheUsuarios;