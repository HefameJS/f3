'use strict';
//const C = global.config;
const L = global.logger;
//const K = global.constants;

// Modelos
const ErrorFedicom = require('modelos/ErrorFedicom');
const CRC = require('modelos/CRC');

// Helpers
const Validador = require('util/validador');


class LineaPedidoCliente {

	constructor(json, txId, numeroPosicion) {

		L.xi(txId, ['Analizando linea de pedido en posicion ' + numeroPosicion])

		this.metadatos = {
			lineaIncorrecta: false
		}

		// Comprobamos los campos mínimos que deben aparecer en cada POSICION de una devolucion
		let errorFedicom = new ErrorFedicom();
		// Estos campos son obligatorios:
		Validador.esCadenaNoVacia(json.codigoArticulo, errorFedicom, 'LIN-PED-ERR-001', 'El campo "codigoArticulo" es inválido');

		// Nota: la cantidad debe ser > 0, pero en el caso de recibir una cantidad inválida, asignaremos un 1.
		//Validador.esEnteroPositivo(json.cantidad, errorFedicom, 'LIN-PED-ERR-002','El campo "cantidad" es inválido');

		// No vamos a hacer que el orden haga perder la línea completa
		//Validador.esEnteroPositivo(json.orden, errorFedicom, 'LIN-PED-ERR-003', 'El campo "orden" es inválido');

		// Si se encuentran errores:
		// - Se describen los errores encontrados en el array de incidencias de la linea.
		// - La posicion se marca como 'sap_ignore=true' para que SAP no la procese.
		// - Rellenamos las faltas, si podemos
		if (errorFedicom.tieneErrores()) {
			L.xw(txId, ['Se han detectado errores graves en la línea', numeroPosicion, errorFedicom]);
			this.metadatos.lineaIncorrecta = true;
			this.incidencias = errorFedicom.getErrores();

			// Como la línea no va a procesarse por SAP, incluimos los valores de faltas ya.
			if (Validador.esEnteroPositivoMayorQueCero(json.cantidad)) {
				this.cantidadFalta = json.cantidad;
			}
			if (Validador.esEnteroPositivoMayorQueCero(json.cantidadBonificacion)) {
				this.cantidadBonificacionFalta = json.cantidadBonificacion;
			}
		}


		// Copiamos las propiedades de la POSICION que son relevantes

		// orden
		if (Validador.existe(json.orden)) {
			if (Validador.esEnteroPositivo(json.orden)) {
				this.orden = parseInt(json.orden);
			} else {
				L.xw(txId, ['El campo "orden" no es un entero >= 0', json.orden]);
				// Si el orden no es válido o no aparece, el objeto de Pedido que contiene esta línea le asignará un orden.
				// por eso no asignamos ningún valor por defecto
			}
		}

		// codigoArticulo
		this.codigoArticulo = json.codigoArticulo?.trim();

		// codigoUbicacion
		if (Validador.esCadenaNoVacia(json.codigoUbicacion)) {
			this.codigoUbicacion = json.codigoUbicacion.trim();
		}

		// cantidad. Los valores no válidos se convierten en un 1.
		this.cantidad = parseInt(json.cantidad) || 1;
		if (this.cantidad <= 0) this.cantidad = 1;

		// cantidadBonificacion
		if (Validador.esEnteroPositivoMayorQueCero(json.cantidadBonificacion)) {
			this.cantidadBonificacion = parseInt(json.cantidadBonificacion);
		}

		// valeEstupefaciente
		if (Validador.esCadenaNoVacia(json.valeEstupefaciente)) {
			this.valeEstupefaciente = json.valeEstupefaciente.trim();
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
				L.xw(txId, ['Se ignora el campo condicion por no ser correcto', json.condicion]);
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
				L.xw(txId, ['El campo "fechaLimiteServicio" no va en formato Fedicom3 Date dd/mm/yyyy', json.ordenLineaAlbaran]);
			}
		}

		// observaciones
		if (Validador.esCadenaNoVacia(json.observaciones)) {
			this.observaciones = json.observaciones.trim();
		}

		this.#generarCRC();
		L.xd(txId, ['Generado CRC de linea', numeroPosicion, this.crc]);

	}

	esLineaCorrecta() {
		return Boolean(!this.sap_ignore);
	}

	generarJSON(generarParaSap = true) {
		let json = {};
		if (this.orden || this.orden === 0) json.orden = this.orden;
		if (this.codigoArticulo) json.codigoArticulo = this.codigoArticulo;
		if (this.codigoUbicacion) json.codigoUbicacion = this.codigoUbicacion;
		if (this.cantidad) {
			json.cantidad = this.cantidad;
			json.cantidadFalta = json.cantidad;
		}
		if (this.cantidadBonificacion) {
			json.cantidadBonificacion = this.cantidadBonificacion;
			json.cantidadBonificacionFalta = json.cantidadBonificacion;
		}
		if (this.valeEstupefaciente) json.valeEstupefaciente = this.valeEstupefaciente;
		if (this.condicion) json.condicion = {
			codigo: this.condicion.codigo,
			fechaInicio: this.condicion.fechaInicio,
			fechaFin: this.condicion.fechaFin
		}
		if (this.servicioDemorado) {
			json.servicioDemorado = this.servicioDemorado;
			json.estadoServicio = 'SR';
		}
		if (this.fechaLimiteServicio) json.fechaLimiteServicio = this.fechaLimiteServicio;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.incidencias) json.incidencias = this.incidencias;
		
		if (generarParaSap) {
			if (this.metadatos.lineaIncorrecta) json.sap_ignore = true;
		}
		return json;
	}


	#generarCRC() {
		this.crc = CRC.generar(
			this.codigoArticulo || '',
			this.cantidad || 1,
			this.cantidadBonificacion || 0,
			this.valeEstupefaciente || ''
		)
	}

}


module.exports = LineaPedidoCliente;
