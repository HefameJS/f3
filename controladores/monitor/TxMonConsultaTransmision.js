'use strict';
const M = global.M;
const fs = require('fs/promises');
const path = require('path');
const SEPARADOR_DIRECTORIOS = path.sep;

const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');


const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');



/**
 * Clase que representa una transmisión de una solicitud de autenticación.
 */
class TxMonConsultaTransmision extends TransmisionLigera {

	#parametros = {
		txId: null,
		tipoConsulta: 'estandar'
	}


	// @Override
	async operar() {

		this.#parametros.txId = this.req.params?.txId;
		this.#parametros.tipoConsulta = this.req.params?.tipoConsulta?.toLowerCase?.() || 'estandar';


		this.log.info(`Consulta de transmisión [txId=${this.#parametros.txId}, tipoConsulta=${this.#parametros.tipoConsulta}]`);


		if (M.ObjectID.isValid(this.#parametros.txId)) {
			this.#parametros.txId = M.ObjectID.createFromHexString(this.#parametros.txId)
		} else {
			let error = new ErrorFedicom('HTTP-400', 'El ID de la transmisión no es válido', 400);
			return error.generarResultadoTransmision();
		}


		switch (this.#parametros.tipoConsulta) {
			case 'logs': return await this.#consultaLogs()
			default: return await this.#consultaEstandard()
		}

	}

	async #consultaEstandard() {
		let transmision = await M.col.transmisiones.findOne({ _id: this.#parametros.txId });
		if (!transmision) {
			let error = new ErrorFedicom('HTTP-404', 'No se encuentra la transmisión indicada', 404);
			return error.generarResultadoTransmision();
		}
		return new ResultadoTransmisionLigera(200, transmision);
	}


	async #consultaLogs() {

		let transmision = await M.col.logs.findOne({ _id: this.#parametros.txId });
		if (!transmision?.l) {
			let error = new ErrorFedicom('HTTP-404', 'No exiten logs para la transmisión indicada', 404);
			return error.generarResultadoTransmision();
		}
		return new ResultadoTransmisionLigera(200, transmision.l);

	}





}


TxMonConsultaTransmision.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonConsultaTransmision;