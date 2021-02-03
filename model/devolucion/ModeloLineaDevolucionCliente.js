'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('model/ModeloErrorFedicom');
const CRC = require('model/CRC');

// Helpers
const Validador = require('util/validador');
const K = require('model/K');

class LineaDevolucionCliente {

	constructor(json, txId, numeroPosicion) {


		L.xi(txId, ['Analizando linea de devolución en posicion ' + numeroPosicion])
		// Comprobamos los campos mínimos que deben aparecer en cada POSICION de una devolucion
		let errorFedicom = new ErrorFedicom();
		// Estos campos son obligatorios:
		Validador.esCadenaNoVacia(json.numeroAlbaran, errorFedicom, 'LIN-DEV-ERR-001', 'El campo "numeroAlbaran" es obligatorio');
		Validador.esFecha(json.fechaAlbaran, errorFedicom, 'LIN-DEV-ERR-002', 'El campo "fechaAlbaran" es incorrecto');
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-DEV-ERR-003', 'El campo "codigoArticulo" es obligatorio');
		Validador.esEnteroPositivoMayorQueCero(json.cantidad, errorFedicom, 'LIN-PED-ERR-004', 'El campo "cantidad" es incorrecto');
		Validador.esCadenaNoVacia(json.codigoMotivo, errorFedicom, 'LIN-DEV-ERR-005', 'El campo "codigoMotivo" es obligatorio');

		// Verificamos que el codigoMotivo es un código válido definido en el protocolo.
		let descripcionMotivo = K.MOTIVO_DEVOLUCION[json.codigoMotivo.trim()];
		if (!descripcionMotivo) {
			L.xe(txId, ['El campo "codigoMotivo" no tiene un valor válido', json.codigoMotivo]);
			errorFedicom.add('LIN-DEV-ERR-005', 'El campo "codigoMotivo" no tiene un valor válido');
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias.
		// - La posicion se marca como 'excluir=true' para que no se envíe a SAP.
		if (errorFedicom.hasError()) {
			L.xw(txId, ['Se han detectado errores graves en la línea', numeroPosicion, errorFedicom]);
			this.excluir = true;
			this.incidencias = errorFedicom.getErrors()
		}


		// Copiamos las propiedades de la POSICION que son relevantes
		this.numeroAlbaran = json.numeroAlbaran?.trim();
		this.fechaAlbaran = json.fechaAlbaran?.trim();
		this.codigoArticulo = json.codigoArticulo?.trim();
		this.cantidad = parseInt(json.cantidad);
		this.codigoMotivo = json.codigoMotivo;


		// Valores que son opcionales
		// Estos campos no son obligatorios, pero se puede salvar la línea si vienen y son incorrectos
		// Se comprobará la validez de los mismos y en caso de ser inválidos se obrará en consecuencia dependiendo del campo

		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.orden = parseInt(json.orden);
			} else {
				L.xw(txId, ['El campo "orden" no es un entero >= 0', json.orden]);
				// Si el orden no es válido o no aparece, el objeto de Devolucion que contiene esta línea le asignará un orden.
				// por eso no asignamos ningún valor por defecto
			}
		}

		// ordenLineaAlbaran
		if (Validador.existe(json.ordenLineaAlbaran)) {
			if (Validador.esEnteroPositivo(json.ordenLineaAlbaran)) {
				this.ordenLineaAlbaran = parseInt(json.ordenLineaAlbaran);
			} else {
				L.xw(txId, ['El campo "ordenLineaAlbaran" no es un entero >= 0', json.ordenLineaAlbaran]);
				// Descartamos el valor en caso de error
			}
		}

		// lote
		if (Validador.existe(json.lote)) {
			if (Validador.esCadenaNoVacia(json.lote)) {
				this.lote = json.lote.trim();
			}
			// Si viene lote: "", lo ignoramos por completo. Algunos programas de farmacia son asín de tontos.
		}

		// fechaCaducidad
		if (Validador.existe(json.fechaCaducidad)) {
			if (Validador.esFecha(json.fechaCaducidad)) {
				this.fechaCaducidad = json.fechaCaducidad.trim();
			} else {
				L.xw(txId, ['El campo "fechaCaducidad" no va en formato Fedicom3 Date dd/mm/yyyy', json.ordenLineaAlbaran]);
			}
		}

		// valeEstupefaciente
		if (Validador.existe(json.valeEstupefaciente)) {
			if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
				this.valeEstupefaciente = json.valeEstupefaciente.trim();
			}
			// Si viene valeEstupefaciente: "", lo ignoramos por completo. Algunos programas de farmacia son asín de tontos.
		}

		// observaciones
		if (Validador.existe(json.observaciones)) {
			if (Validador.esCadenaNoVacia(json.observaciones)) {
				this.observaciones = json.observaciones.trim();
			}
			// Si viene observaciones: "", lo ignoramos por completo. Algunos programas de farmacia son asín de tontos.
		}


		// Generacion de CRC de línea
		this.#generarCRC();
		L.xd(txId, ['Generado CRC de linea', numeroPosicion, this.crc]);

	}

	generarJSON() {
		let json = {};
		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.numeroAlbaran) json.numeroAlbaran = this.numeroAlbaran;
		if (this.fechaAlbaran) json.fechaAlbaran = this.fechaAlbaran;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.cantidad || this.cantidad === 0) json.cantidad = this.cantidad;
		if (this.codigoMotivo) json.codigoMotivo = this.codigoMotivo;
		if (this.incidencias) json.incidencias = this.incidencias;
		if (this.lote) json.lote = this.lote;
		if (this.fechaCaducidad) json.fechaCaducidad = this.fechaCaducidad;
		if (this.valeEstupefaciente) json.valeEstupefaciente = this.valeEstupefaciente;
		if (this.observaciones) json.observaciones = this.observaciones;
		return json;
	}

	#generarCRC() {
		this.crc = CRC.generar(
			this.codigoMotivo,
			this.numeroAlbaran,
			this.fechaAlbaran,
			this.codigoArticulo,
			this.cantidad,
			this.lote,
			this.fechaCaducidad,
			this.valeEstupefaciente
		)
	}

}


module.exports = LineaDevolucionCliente;
