'use strict';
const C = global.config;
const ErrorFedicom = require('modelos/ErrorFedicom');
const Validador = require('global/validador');
const Modelo = require('modelos/transmision/Modelo');


class LineaDevolucionCliente extends Modelo {

	metadatos = {
		numeroPosicion: 0,
		errores: new ErrorFedicom(),
		errorProtocolo: false,
		estupefaciente: false
	}


	orden;
	ordenLineaAlbaran;
	numeroAlbaran;
	fechaAlbaran;
	codigoArticulo;
	cantidad;
	codigoMotivo;
	lote;
	fechaCaducidad;
	valeEstupefaciente;
	observaciones;

	constructor(transmision, json, numeroPosicion) {

		super(transmision);

		this.log.info(`Posición ${numeroPosicion}: Analizando linea de devolución`);
		this.metadatos.numeroPosicion = numeroPosicion;

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
				this.log.warn(`Posición ${numeroPosicion}: El motivo '${json.codigoMotivo}' no es un código de motivo válido`);
				errorFedicom.insertar('LIN-DEV-ERR-005', 'El campo "codigoMotivo" no tiene un valor válido');
			}
		}

		// Los campos "numeroAlbaran" y "fechaAlbaran" son opcionales en determinados motivos de devolución
		if (!C.devoluciones.motivoExentoDeAlbaran(codigoMotivoSaneado)) {
			Validador.esCadenaNoVacia(json.numeroAlbaran, errorFedicom, 'LIN-DEV-ERR-001', 'El campo "numeroAlbaran" es obligatorio');
			Validador.esFecha(json.fechaAlbaran, errorFedicom, 'LIN-DEV-ERR-002', 'El campo "fechaAlbaran" es incorrecto');
		} else {
			this.log.info(`Posición ${numeroPosicion}: El codigo de motivo '${json.codigoMotivo}' exento de prensentar numeroAlbaran y fechaAlbaran`);
		}

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias.
		// - La posicion se marca como 'excluir=true' para que no se envíe a SAP.
		if (errorFedicom.tieneErrores()) {
			this.log.warn(`Posición ${numeroPosicion}: Se han detectado errores graves de protocolo en la línea`, errorFedicom);
			this.metadatos.errorProtocolo = true;
			this.metadatos.errores = errorFedicom;
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
				this.log.warn(`Posición ${numeroPosicion}: El valor '${json.orden}' no es válido para el campo 'orden'`);
			}
		}

		// ordenLineaAlbaran
		if (Validador.existe(json.ordenLineaAlbaran)) {
			if (Validador.esEnteroPositivo(json.ordenLineaAlbaran)) {
				this.ordenLineaAlbaran = parseInt(json.ordenLineaAlbaran);
			} else {
				this.warn(`Posición ${numeroPosicion}: El valor '${json.ordenLineaAlbaran}' no es válido para el campo 'ordenLineaAlbaran'`);
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
				this.log.warn(`Posición ${numeroPosicion}: El valor '${json.fechaCaducidad}' en 'fechaCaducidad' no va en formato Fedicom3 Date dd/mm/yyyy`);
			}
		}

		// valeEstupefaciente
		if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
			this.valeEstupefaciente = json.valeEstupefaciente.trim();
			this.metadatos.estupefaciente = true;
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

	}


	tieneErrores() {
		return this.metadatos.errorProtocolo
	}


	/**
	 * 
	 * @param {*} tipoReceptor 
	 * @returns 
	 */
	generarJSON(tipoReceptor = 'sap') {

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
		if (this.metadatos.errores) {
			json.incidencias = this.metadatos.errores.getErrores();
		}

		return json;
	}


}


module.exports = LineaDevolucionCliente;
