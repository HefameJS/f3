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

	#transmision;
	#log;

	#metadatos = {
		numeroPosicion: 0,
		errores: null,
		lineaIncorrecta: false,
		crc: null,
		estupefaciente: false
	}

	#datos = {
		orden: null,
		ordenLineaAlbaran: null,
		numeroAlbaran: null,
		fechaAlbaran: null,
		codigoArticulo: null,
		cantidad: null,
		codigoMotivo: null,
		lote: null,
		fechaCaducidad: null,
		valeEstupefaciente: null,
		observaciones: null
	}

	constructor(transmision, json, numeroPosicion) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;

		this.#log.info(`Posición ${numeroPosicion}: Analizando linea de devolución`);
		this.#metadatos.numeroPosicion = numeroPosicion;

		// Comprobamos los campos mínimos que deben aparecer en cada POSICION de una devolucion
		let errorFedicom = new ErrorFedicom();
		// Estos campos son obligatorios siempre
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-DEV-ERR-003', 'El campo "codigoArticulo" es obligatorio');
		Validador.esEnteroPositivoMayorQueCero(json.cantidad, errorFedicom, 'LIN-PED-ERR-004', 'El campo "cantidad" es incorrecto');

		// Verificamos que el codigoMotivo es un código válido definido en el protocolo.
		// Si viene un entero o un string de longitud 1, convertimos a string con relleno de 0 a la izquierda.
		let codigoMotivoSaneado;
		if (Validador.existe(json.codigoMotivo, errorFedicom, 'LIN-DEV-ERR-005', 'El campo "codigoMotivo" es obligatorio')) {
			codigoMotivoSaneado = json.codigoMotivo.toString().trim();
			if (codigoMotivoSaneado.length === 1) codigoMotivoSaneado = codigoMotivoSaneado.padStart(2, '0');

			let descripcionMotivo = C.devoluciones.motivos[codigoMotivoSaneado];
			if (!descripcionMotivo) {
				this.#log.warn(`Posición ${numeroPosicion}: El motivo '${json.codigoMotivo}' no es un código de motivo válido`);
				errorFedicom.insertar('LIN-DEV-ERR-005', 'El campo "codigoMotivo" no tiene un valor válido');
			}
		}

		// Los campos "numeroAlbaran" y "fechaAlbaran" son opcionales en determinados motivos de devolución
		if (!C.devoluciones.motivoExentoDeAlbaran(codigoMotivoSaneado)) {
			Validador.esCadenaNoVacia(json.numeroAlbaran, errorFedicom, 'LIN-DEV-ERR-001', 'El campo "numeroAlbaran" es obligatorio');
			Validador.esFecha(json.fechaAlbaran, errorFedicom, 'LIN-DEV-ERR-002', 'El campo "fechaAlbaran" es incorrecto');
		} else {
			this.#log.info(`Posición ${numeroPosicion}: El codigo de motivo '${json.codigoMotivo}' exento de prensentar numeroAlbaran y fechaAlbaran`);
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias.
		// - La posicion se marca como 'excluir=true' para que no se envíe a SAP.
		if (errorFedicom.tieneErrores()) {
			this.#log.warn(`Posición ${numeroPosicion}: Se han detectado errores graves de protocolo en la línea`, errorFedicom);
			this.#metadatos.errores = errorFedicom;
		}


		// Copiamos las propiedades de la POSICION que son relevantes
		this.#datos.numeroAlbaran = json.numeroAlbaran?.trim();
		this.#datos.fechaAlbaran = json.fechaAlbaran?.trim();
		this.#datos.codigoArticulo = json.codigoArticulo?.trim();
		this.#datos.cantidad = parseInt(json.cantidad) || 0;
		this.#datos.codigoMotivo = json.codigoMotivo;




		// Valores que son opcionales
		// Estos campos no son obligatorios, y se puede salvar la línea si vienen y son incorrectos
		// Se comprobará la validez de los mismos y en caso de ser inválidos se obrará en consecuencia dependiendo del campo

		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.#datos.orden = parseInt(json.orden);
			} else {
				this.#log.warn(`Posición ${numeroPosicion}: El valor '${json.orden}' no es válido para el campo 'orden'`);
				// Si el orden no es válido o no aparece, el objeto de Devolucion que contiene esta línea le asignará un orden.
				// por eso no asignamos ningún valor por defecto
			}
		}

		// ordenLineaAlbaran
		if (Validador.existe(json.ordenLineaAlbaran)) {
			if (Validador.esEnteroPositivo(json.ordenLineaAlbaran)) {
				this.#datos.ordenLineaAlbaran = parseInt(json.ordenLineaAlbaran);
			} else {
				this.#log.warn(`Posición ${numeroPosicion}: El valor '${json.ordenLineaAlbaran}' no es válido para el campo 'ordenLineaAlbaran'`);
				// Descartamos el valor en caso de error
			}
		}

		// lote
		if (Validador.esCadenaNoVacia(json.lote)) {
			this.#datos.lote = json.lote.trim();
		}

		// fechaCaducidad
		if (Validador.existe(json.fechaCaducidad)) {
			if (Validador.esFecha(json.fechaCaducidad)) {
				this.#datos.fechaCaducidad = json.fechaCaducidad.trim();
			} else {
				this.#log.warn(`Posición ${numeroPosicion}: El valor '${json.fechaCaducidad}' en 'fechaCaducidad' no va en formato Fedicom3 Date dd/mm/yyyy`);
			}
		}

		// valeEstupefaciente
		if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
			this.#datos.valeEstupefaciente = json.valeEstupefaciente.trim();
			this.#metadatos.estupefaciente = true;
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.#datos.observaciones = json.observaciones.trim();
		}


		// Generacion de CRC de línea
		this.#generarCRC();
		this.#log.debug(`Posición ${numeroPosicion}: Generado CRC de linea ${this.#metadatos.crc}`);

	}


	getCrc() {
		return this.#metadatos.crc;
	}

	getNumeroPosicion() {
		return this.#metadatos.numeroPosicion;
	}

	tieneErroresDeProtocolo() {
		return (this.#metadatos.errores !== null)
	}



	getOrdinal() {
		return this.#datos.orden;
	}

	setOrdinal(orden) {
		this.#datos.orden = orden;
	}

	getCantidad() {
		return this.#datos.cantidad || 0;
	}


	/**
	 * 
	 * @param {*} tipoReceptor 
	 * @returns 
	 */
	generarJSON(tipoReceptor = 'sap') {

		let json = {};
		if (this.#datos.orden || this.#datos.orden === 0) json.orden = this.#datos.orden;
		if (this.#datos.numeroAlbaran) json.numeroAlbaran = this.#datos.numeroAlbaran;
		if (this.#datos.fechaAlbaran) json.fechaAlbaran = this.#datos.fechaAlbaran;
		if (this.#datos.codigoArticulo) json.codigoArticulo = this.#datos.codigoArticulo;
		if (this.#datos.cantidad || this.#datos.cantidad === 0) json.cantidad = this.#datos.cantidad;
		if (this.#datos.codigoMotivo) json.codigoMotivo = this.#datos.codigoMotivo;
		if (this.#datos.incidencias) json.incidencias = this.#datos.incidencias;
		if (this.#datos.lote) json.lote = this.#datos.lote;
		if (this.#datos.fechaCaducidad) json.fechaCaducidad = this.#datos.fechaCaducidad;
		if (this.#datos.valeEstupefaciente) json.valeEstupefaciente = this.#datos.valeEstupefaciente;
		if (this.#datos.observaciones) json.observaciones = this.#datos.observaciones;
 
		if (tipoReceptor === 'lineasInvalidas') {
			if (this.#metadatos.errores) {
				json.incidencias = this.#metadatos.errores.getErrores();
			}
		}

		return json;
	}

	#generarCRC() {
		this.#metadatos.crc = CRC.generar(
			this.#datos.codigoMotivo,
			this.#datos.numeroAlbaran,
			this.#datos.fechaAlbaran,
			this.#datos.codigoArticulo,
			this.#datos.cantidad,
			this.#datos.lote,
			this.#datos.fechaCaducidad,
			this.#datos.valeEstupefaciente
		)
	}

}


module.exports = LineaDevolucionCliente;
