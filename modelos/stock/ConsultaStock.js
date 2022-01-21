'use strict';

const ErrorFedicom = require("modelos/ErrorFedicom");
const Modelo = require("modelos/transmision/Modelo");



/**
 * codigoCliente: <string> 
 * tipoConsulta: <string> 
 */
class ConsultaStock extends Modelo {

	metadatos = {
		errores: new ErrorFedicom(),
		errorProtocolo: false			// Indica si la petición cumple o no con el protocolo
	}

	codigoCliente;
	tipoConsulta;

	constructor(transmision) {
		super(transmision);

		let query = this.transmision.req.query;

		this.#procesarCodigoCliente(query.codigoCliente);
		this.#procesarTipoConsulta(query.tipoConsulta);

	}

	tieneErrores() {
		return this.metadatos.errorProtocolo;
	}

	getErrores() {
		return this.metadatos.errores.getErrores();
	}

	#procesarCodigoCliente(codigoCliente) {

		if (!codigoCliente) {
			this.metadatos.errores.insertar('STOCK-ERR-003', 'El "codigoCliente" es inválido.');
			this.metadatos.errorProtocolo = true;
			return;
		}

		// Si el código de cliente está en formato corto, vamos a utilizar el código de login
		// aprovechando que la búsqueda se realiza entre todos los códigos del mismo cliente.

		if (codigoCliente.length < 8) {
			let usuarioToken = this.transmision.token.getDatos().usuario;

			let codigoClienteLargo = codigoCliente;
			// Casos en donde el usuario es de la forma xxxxxxxx@hefame
			if (usuarioToken.includes('@')) {
				// Nos quedamos con la parte que va delante de la arroba.
				codigoClienteLargo = usuarioToken.split('@')[0];
			}
			// Casos de usuarios Borgino que son de la forma BF02901xxxxx
			else if (usuarioToken.startsWith('BF')) {
				// Eliminamos el BF y nos quedamos con el resto
				codigoClienteLargo = usuarioToken.slice(2);
			}

			this.log.info(`Se cambia el código de cliente corto por el del token. "${codigoCliente}" -> "${codigoClienteLargo}"`)
			codigoCliente = codigoClienteLargo;
		}

		this.codigoCliente = codigoCliente.padStart(10, '0');
	}

	#procesarTipoConsulta(tipoConsulta) {

		if (tipoConsulta !== "F10") {
			this.metadatos.errores.insertar('STOCK-ERR-002', 'El "tipoConsulta" es inválido.');
			this.metadatos.errorProtocolo = true;
			return;
		}

		this.tipoConsulta = tipoConsulta;
	}

	generarParametrosLlamadaSap() {
		return this.codigoCliente + '/retard/'
	}

	generarJSON() {
		return {
			codigoCliente: this.codigoCliente,
			tipoConsulta: this.tipoConsulta,
		}
	}
}



module.exports = ConsultaStock;