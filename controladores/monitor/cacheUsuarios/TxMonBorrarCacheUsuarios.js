'use strict';
const M = global.M;
const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');


/**
 * Transmision que devuelve un token de observador
 */
class TxMonBorrarCacheUsuarios extends TransmisionLigera {

	// @Override
	async operar() {
		let idUsuario = this.req.params.idUsuario || null;
		let resultadoMongo = null;
		try {
			if (idUsuario) {
				this.log.info(`Eliminando los datos del usuario ${idUsuario} de la caché de credenciales`);
				resultadoMongo = await M.col.cacheUsuarios.deleteOne({ _id: idUsuario }, {
					writeConcern: { w: "majority", j: true }
				});
			} else {
				this.log.info(`Vaciando por completo la caché de credenciales`);
				resultadoMongo = await M.col.cacheUsuarios.deleteMany({}, {
					writeConcern: { w: "majority", j: true }
				});
			}
			return new ResultadoTransmisionLigera(200, {borrados: resultadoMongo.deletedCount});
		} catch (error) {
			return (new ErrorFedicom(error)).generarResultadoTransmision();
		}
	}

}


TxMonBorrarCacheUsuarios.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_INSTANCIAS'
});


module.exports = TxMonBorrarCacheUsuarios;