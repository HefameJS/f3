'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const CRC = require('modelos/CRC');

// Helpers
const Validador = require('global/validador');


class LineaPedidoCliente {

	#transmision;		// Referencia a la transmisión del pedido
	#log;				// Referencia a this.#transmision.log

	#metadatos = {
		errores: null,
		lineaIncorrecta: false,
		crc: null,
		estupefaciente: false
	}

	#datos = {
		orden: null,
		codigoArticulo: null,
		codigoUbicacion: null,
		cantidad: null,
		valeEstupefaciente: null,
		condicion: null,
		servicioDemorado: null,
		fechaLimiteServicio: null,
		observaciones: null
	}

	constructor(transmision, json, numeroPosicion) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;

		this.#log.debug(`Analizando linea de pedido en posición ${numeroPosicion}`)


		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-PED-ERR-001', 'El campo "codigoArticulo" es inválido');

		if (errorFedicom.tieneErrores()) {
			this.#log.warn(`Posicion ${numeroPosicion}: La línea no cumple con la norma Fedicom3`, errorFedicom);
			this.#metadatos.lineaIncorrecta = true;
			this.addError(errorFedicom);
		}


		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.#datos.orden = parseInt(json.orden);
			} else {
				this.#log.warn(`Posicion ${numeroPosicion}: Se elimina el valor de "orden" por no ser válido: ${json.orden}`);
				// Si el orden no es válido o no aparece, el objeto de Pedido que contiene esta línea le asignará un orden.
				// por eso no asignamos ningún valor por defecto
			}
		}

		// codigoArticulo
		this.#datos.codigoArticulo = json.codigoArticulo?.trim?.();

		// codigoUbicacion - No hacemos trim() por si los espacios significan algo
		if (Validador.esCadenaNoVacia(json.codigoUbicacion)) {
			this.#datos.codigoUbicacion = json.codigoUbicacion;
		}

		// cantidad. Los valores no válidos se convierten en un 1.
		// Nota: la cantidad debe ser > 0, pero en el caso de recibir una cantidad inválida, asignaremos un 1.
		this.#datos.cantidad = parseInt(json.cantidad) || null;
		if (this.#datos.cantidad <= 0) {
			this.#log.warn(`Posicion ${numeroPosicion}: Se establece el valor de "cantidad" a 1 por no ser válido: ${json.cantidad}`)
			this.#datos.cantidad = 1;
		}

		// valeEstupefaciente
		if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
			this.#datos.valeEstupefaciente = json.valeEstupefaciente.trim();
			this.#metadatos.estupefaciente = true;
		}

		// condicion: {codigo: string, fechaInicio: DateTime, fechaFin: DateTime}
		if (Validador.existe(json.condicion)) {
			let cond = json.condicion;
			if (Validador.esCadenaNoVacia(cond.codigo) && Validador.esFechaHora(cond.fechaInicio) && Validador.esFechaHora(cond.fechaFin)) {
				this.#datos.condicion = {
					codigo: cond.codigo.trim(),
					fechaInicio: cond.fechaInicio.trim(),
					fechaFin: cond.fechaFin.trim()
				};
			} else {
				this.#log.warn(`Posicion ${numeroPosicion}: Se ignora el campo "condicion" por no ser válido: ${json.condicion}`);
			}
		}

		// servicioDemorado
		if (json.servicioDemorado) {
			this.#datos.servicioDemorado = true;
		}

		// fechaLimiteServicio
		if (Validador.existe(json.fechaLimiteServicio)) {
			if (Validador.esFechaHora(json.fechaLimiteServicio)) {
				this.#datos.fechaLimiteServicio = json.fechaLimiteServicio.trim();
			} else {
				this.#log.warn(`Posicion ${numeroPosicion}: Se ignora el campo "fechaLimiteServicio" por no ser válido: ${json.fechaLimiteServicio}`);
			}
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.#datos.observaciones = json.observaciones.trim();
		}


	}



	getCrc() {
		return this.#metadatos.crc;
	}

	getNumeroPosicion() {
		return this.#datos.orden;
	}

	setNumeroPosicion(orden) {
		this.#datos.orden = orden;
	}

	/**
	 * Anota un error en la linea de pedido
	 * Se puede indicar el (codigo, descripcion) del error, o pasar un único parametro con un objeto instancia de ErrorFedicom
	 * @param {*} codigo 
	 * @param {*} descripcion 
	 */
	addError(codigo, descripcion) {
		if (!this.#metadatos.errores)
			this.#metadatos.errores = new ErrorFedicom();

		this.#metadatos.errores.insertar(codigo, descripcion)
	}


	esLineaCorrecta() {
		return !Boolean(this.#metadatos.errores);
	}



	/**
	 * Genera un JSON con los datos de la línea listo para ser enviado vía HTTP. 
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'lineasInvalidas': El receptor es un cliente y la transmisión contiene errores en todas las líneas
	 * - 'noSap': El receptor es un cliente y no se han podido determinar las faltas del pedido
	 * 
	 * @param {*} tipoReceptor Indica el tipo del receptor al que va dirigido el JSON.
	 * @returns JSON con los datos de la línea
	 */
	generarJSON(tipoReceptor = 'sap') {

		let json = {};

		if (this.#datos.orden || this.orden === 0) json.orden = this.#datos.orden;
		if (this.#datos.codigoArticulo) json.codigoArticulo = this.#datos.codigoArticulo;
		if (this.#datos.codigoUbicacion) json.codigoUbicacion = this.#datos.codigoUbicacion;
		if (this.#datos.cantidad >= 0) json.cantidad = this.#datos.cantidad;
		if (this.#datos.valeEstupefaciente) json.valeEstupefaciente = this.#datos.valeEstupefaciente;
		if (this.#datos.condicion) json.condicion = this.#datos.condicion;

		if (this.#datos.servicioDemorado) {
			json.servicioDemorado = this.#datos.servicioDemorado;
			if (['noSap', 'lineasInvalidas'].includes(tipoReceptor)) json.estadoServicio = 'SR';
		}

		if (this.#datos.fechaLimiteServicio) json.fechaLimiteServicio = this.#datos.fechaLimiteServicio;
		if (this.#datos.observaciones) json.observaciones = this.#datos.observaciones;

		if (this.#metadatos.errores) json.incidencias = this.#metadatos.errores.getErrores();

		if (['sap'].includes(tipoReceptor)) {
			if (this.#metadatos.lineaIncorrecta) json.sap_ignore = true;
		}
		return json;
	}


	#generarCRC() {
		this.#metadatos.crc = CRC.generar(
			this.codigoArticulo || '',
			this.cantidad || 1,
			this.cantidadBonificacion || 0,
			this.valeEstupefaciente || ''
		)
	}

}


module.exports = LineaPedidoCliente;
