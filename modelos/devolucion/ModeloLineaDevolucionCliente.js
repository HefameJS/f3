'use strict';
const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const CRC = require('modelos/CRC');

// Helpers
const Validador = require('global/validador');


class LineaDevolucionCliente {

	constructor(json, txId, numeroPosicion) {


		L.xi(txId, ['Analizando linea de devolución en posicion ', numeroPosicion])
		// Comprobamos los campos mínimos que deben aparecer en cada POSICION de una devolucion
		let errorFedicom = new ErrorFedicom();
		// Estos campos son obligatorios siempre
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-DEV-ERR-003', 'El campo "codigoArticulo" es obligatorio');
		Validador.esEnteroPositivoMayorQueCero(json.cantidad, errorFedicom, 'LIN-PED-ERR-004', 'El campo "cantidad" es incorrecto');



		// Verificamos que el codigoMotivo es un código válido definido en el protocolo.
		// 09-03-2021 Si viene un entero o un string de longitud 1, convertimos a string con relleno de 0 a la izquierda.
		let codigoMotivoSaneado;
		if (Validador.existe(json.codigoMotivo, errorFedicom, 'LIN-DEV-ERR-005', 'El campo "codigoMotivo" es obligatorio')) {
			codigoMotivoSaneado = json.codigoMotivo.toString().trim();
			if (codigoMotivoSaneado.length === 1) codigoMotivoSaneado = codigoMotivoSaneado.padStart(2, '0');

			let descripcionMotivo = C.devoluciones.motivos[codigoMotivoSaneado];
			if (!descripcionMotivo) {
				L.xe(txId, ['El campo "codigoMotivo" no tiene un valor válido', json.codigoMotivo]);
				errorFedicom.insertar('LIN-DEV-ERR-005', 'El campo "codigoMotivo" no tiene un valor válido');
			}
		}

		// Los campos "numeroAlbaran" y "fechaAlbaran" son opcionales en determinados motivos de devolución
		if (!C.devoluciones.motivoExentoDeAlbaran(codigoMotivoSaneado)) {
			Validador.esCadenaNoVacia(json.numeroAlbaran, errorFedicom, 'LIN-DEV-ERR-001', 'El campo "numeroAlbaran" es obligatorio');
			Validador.esFecha(json.fechaAlbaran, errorFedicom, 'LIN-DEV-ERR-002', 'El campo "fechaAlbaran" es incorrecto');
		} else {
			L.xi(txId, ['La línea tiene un codigo de motivo exento de prensentar numeroAlbaran y fechaAlbaran', numeroPosicion]);
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias.
		// - La posicion se marca como 'excluir=true' para que no se envíe a SAP.
		if (errorFedicom.tieneErrores()) {
			L.xw(txId, ['Se han detectado errores graves en la línea', numeroPosicion, errorFedicom]);
			this.excluir = true;
			this.incidencias = errorFedicom.getErrores()
		}


		// Copiamos las propiedades de la POSICION que son relevantes
		this.numeroAlbaran = json.numeroAlbaran?.trim();
		this.fechaAlbaran = json.fechaAlbaran?.trim();
		this.codigoArticulo = json.codigoArticulo?.trim();
		this.cantidad = parseInt(json.cantidad) || 0;
		this.codigoMotivo = json.codigoMotivo;




		// Valores que son opcionales
		// Estos campos no son obligatorios, y se puede salvar la línea si vienen y son incorrectos
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
		if (Validador.esCadenaNoVacia(json.lote)) {
			this.lote = json.lote.trim();
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
		if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
			this.valeEstupefaciente = json.valeEstupefaciente.trim();
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
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
