'use strict';
const Modelo = require('modelos/transmision/Modelo');
const ErrorFedicom = require('modelos/ErrorFedicom');
const Crc = require('modelos/CRC');
const Validador = require('global/validador');



class LineaPedidoCliente extends Modelo {

	metadatos = {
		numeroPosicion: null,
		errores: null,
		tieneErroresDeProtocolo: false,
		crc: null,
		estupefaciente: false
	}

	orden;
	codigoArticulo;
	codigoUbicacion;
	cantidad;
	valeEstupefaciente;
	condicion;
	servicioDemorado;
	fechaLimiteServicio;
	observaciones;


	constructor(transmision, json, numeroPosicion) {
		super(transmision);
		
		this.metadatos.numeroPosicion = numeroPosicion;
		this.log.debug(`Posición ${numeroPosicion}: Analizando línea de pedido`)


		let errorFedicom = new ErrorFedicom();
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-PED-ERR-001', 'El campo "codigoArticulo" es inválido');

		if (errorFedicom.tieneErrores()) {
			this.log.warn(`Posición ${numeroPosicion}: La línea no cumple con la norma Fedicom3`, errorFedicom);
			this.metadatos.tieneErroresDeProtocolo = true;
			this.metadatos.errores.insertar(errorFedicom);
		}


		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.orden = parseInt(json.orden);
			} else {
				this.log.warn(`Posición ${numeroPosicion}: Se elimina el valor de "orden" por no ser válido: ${json.orden}`);
				// Si el orden no es válido o no aparece, el objeto de Pedido que contiene esta línea le asignará un orden.
				// por eso no asignamos ningún valor por defecto
			}
		}

		// codigoArticulo
		this.codigoArticulo = json.codigoArticulo?.trim?.();

		// codigoUbicacion - No hacemos trim() por si los espacios significan algo
		if (Validador.esCadenaNoVacia(json.codigoUbicacion)) {
			this.codigoUbicacion = json.codigoUbicacion;
		}

		// cantidad. Los valores no válidos se convierten en un 1.
		// Nota: la cantidad debe ser > 0, pero en el caso de recibir una cantidad inválida, asignaremos un 1.
		this.cantidad = parseInt(json.cantidad) || null;
		if (this.cantidad <= 0) {
			this.log.warn(`Posición ${numeroPosicion}: Se establece el valor de "cantidad" a 1 por no ser válido: ${json.cantidad}`)
			this.cantidad = 1;
		}

		// valeEstupefaciente
		if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
			this.valeEstupefaciente = json.valeEstupefaciente.trim();
			this.metadatos.estupefaciente = true;
		}

		// condicion: {codigo: string, fechaInicio: DateTime, fechaFin: DateTime}
		if (Validador.existe(json.condicion)) {
			let cond = json.condicion;
			if (Validador.esCadenaNoVacia(cond.codigo) && Validador.esFechaHora(cond.fechaInicio) && Validador.esFechaHora(cond.fechaFin)) {
				this.condicion = {
					codigo: cond.codigo.trim(),
					fechaInicio: cond.fechaInicio.trim(),
					fechaFin: cond.fechaFin.trim()
				};
			} else {
				this.log.warn(`Posición ${numeroPosicion}: Se ignora el campo "condicion" por no ser válido: ${json.condicion}`);
			}
		}

		// servicioDemorado
		if (json.servicioDemorado) {
			this.servicioDemorado = true;
		}

		// fechaLimiteServicio
		if (Validador.existe(json.fechaLimiteServicio)) {
			if (Validador.esFechaHora(json.fechaLimiteServicio)) {
				this.fechaLimiteServicio = json.fechaLimiteServicio.trim();
			} else {
				this.log.warn(`Posicion ${numeroPosicion}: Se ignora el campo "fechaLimiteServicio" por no ser válido: ${json.fechaLimiteServicio}`);
			}
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

		this.metadatos.crc = Crc.generar(
			this.codigoArticulo || '',
			this.cantidad || 1,
			this.cantidadBonificacion || 0,
			this.valeEstupefaciente || ''
		)

	}


	tieneErrores() {
		return this.metadatos.tieneErroresDeProtocolo;
	}



	/**
	 * Genera un JSON con los datos de la línea listo para ser enviado vía HTTP. 
	 * Se puede especificar el tipo de receptor al que va destinado el JSON:
	 * - 'sap' Indica que el destino del JSON es SAP
	 * - 'noSap': El destino es un cliente y se le está dando el error de que no se pudieron determinar las faltas o de que la línea no es válida
	 * 
	 * @param {*} tipoReceptor Indica el tipo del receptor al que va dirigido el JSON.
	 * @returns JSON con los datos de la línea
	 */
	generarJSON(tipoReceptor = 'sap') {

		let json = {};

		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.codigoUbicacion) json.codigoUbicacion = this.codigoUbicacion;
		if (this.cantidad >= 0) json.cantidad = this.cantidad;
		if (this.valeEstupefaciente) json.valeEstupefaciente = this.valeEstupefaciente;
		if (this.condicion) json.condicion = this.condicion;
		if (this.servicioDemorado) {
			json.servicioDemorado = this.servicioDemorado;
			if (tipoReceptor !== 'sap') json.estadoServicio = 'SR';
		}
		if (this.fechaLimiteServicio) json.fechaLimiteServicio = this.fechaLimiteServicio;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.metadatos.errores) json.incidencias = this.metadatos.errores.getErrores();

		if (tipoReceptor === 'sap') {
			if (this.metadatos.tieneErroresDeProtocolo) json.sap_ignore = true;
		}
		return json;
	}

}


module.exports = LineaPedidoCliente;
