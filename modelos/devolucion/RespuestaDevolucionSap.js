'use strict';
const C = global.config;
const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iflags/iFlags');
const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const LineaDevolucionSap = require('./LineaDevolucionSap');


class RespuestaDevolucionSap {

	#transmision;
	#log;

	#metadatos = {
		numeroObjetoDevolucion: 0,			// (int) Es el índice de este objeto en el array de objetos devuelto por SAP
		creaOrdenLogistica: false,			// (bool) Indica si en este objeto se indica un código de orden de logística
		clienteNoExiste: false,				// (bool) Indica si SAP ha indicado la incidencia de que el cliente no existe
		devolucionDuplicadaSap: false,		// (bool) Indica si SAP ha indicado la incidencia de que la devolución es duplicada
		incidenciasCabecera: false,			// (bool) Indica si aparecen incidencias de cabecera "no controladas" en la respuesta de SAP
		lineasDescartadas: false,			// (bool) Indica si las lineas contenidas en este objeto son lineas que se han descartado
		puntoEntrega: null,					// (string) Indica el punto de entrega del cliente, o null si no se puede determinar
		numerosDevolucionSap: [],			// (Array(int)) Indica la lista con los números de devolución de SAP (los reales de la BAPI)
		totales: {							// Pues eso:
			lineas: 0,
			lineasIncidencias: 0,
			lineasEstupe: 0,
			cantidad: 0,
			cantidadIncidencias: 0,
			cantidadEstupe: 0
		}
	}

	#datos = {
		codigoCliente: null,
		numeroDevolucion: null,
		fechaDevolucion: null,
		codigoRecogida: null,
		numeroAlbaranAbono: null,
		fechaAlbaranAbono: null,
		empresaFacturadora: null,
		observaciones: null,
		incidencias: []
	}

	/**
	 * Construye el objeto de la petición de devolución a partir de la peticion HTTP del cliente.
	 */
	constructor(transmision, indice) {

		this.#transmision = transmision;
		this.#log = this.#transmision.log;

		let json = this.#transmision.sap.getRespuesta()[indice];

		this.#log.info(`Objeto Devolución #${indice}: Creando objeto de respuesta de devolución con los datos obtenidos de SAP`);
		this.#metadatos.numeroObjetoDevolucion = indice;

		// Copiamos las propiedades de la CABECERA que son relevantes		
		this.#datos.codigoCliente = json.codigocliente;
		this.#datos.numeroDevolucion = json.numerodevolucion || null;
		this.#datos.fechaDevolucion = json.fechadevolucion || null;
		this.#datos.codigoRecogida = json.codigorecogida || null;
		this.#datos.numeroAlbaranAbono = json.numeroalbaranabono || null;
		this.#datos.fechaAlbaranAbono = json.fechaalbaranabono || null;
		this.#datos.empresaFacturadora = json.empresafacturadora || null;
		this.#datos.observaciones = json.observaciones || null;

		// Algunas incidencias tienen un tratamiento especial
		this.#procesarIncidenciasSap(json.incidencias);

		// Rellenamos metadatos
		this.#metadatos.creaOrdenLogistica = Boolean(this.#datos.codigoRecogida);
		this.#metadatos.puntoEntrega = json.sap_punto_entrega || null;
		this.#metadatos.lineasDescartadas = !Boolean(this.#datos.numeroDevolucion);
		if (this.#metadatos.lineasDescartadas) {
			this.#log.warn(`Objeto Devolución #${indice}: No indica numero de devolución -> las lineas has sido descartadas por SAP`);
		}

		// Extracción de información de las lineas
		this.#extraerLineas(json.lineas);

	}


	/**
	 * Realiza un saneamiento de las incidencias que nos manda SAP
	 * @param {*} incidenciasJson 
	 */
	#procesarIncidenciasSap(incidenciasJson) {
		this.#datos.incidencias = [];
		incidenciasJson.forEach(incidencia => {

			// CLIENTE NO EXISTE
			// Hay 2 modos de encontrarse esta incidencia, en funcion de donde se detecte:
			// PRE-BAPI => {"codigo": "DEV-ERR-002", "descripcion": "El parametro CodigoClientee es invalido" }
			// BAPI     => {"codigo": "", "descripcion"; "Cliente desconocido"}
			if (incidencia.codigo === "DEV-ERR-002" || incidencia.descripcion === "Cliente desconocido") {
				this.#log.info(`Objeto Devolución #${this.#metadatos.numeroObjetoDevolucion}: Se encuentra la incidencia de cliente desconocido => "${incidencia.descripcion}"`);
				this.#metadatos.clienteNoExiste = true;
				
			}
			// DEVOLUCION DUPLICADA
			// {"codigo": "", "descripcion"; "Devolución duplicada"}
			else if (incidencia.descripcion === "Devolución duplicada") {
				this.#log.info(`Objeto Devolución #${this.#metadatos.numeroObjetoDevolucion}: Se encuentra la incidencia de devolucion duplicada`);
				this.#metadatos.devolucionDuplicadaSap = true;
			}
			// OTRAS INCIDENCIAS
			else {
				if (!incidencia.codigo) incidencia.codigo = 'DEV-ERR-999';
				this.#datos.incidencias.push(incidencia);
				this.#metadatos.incidenciasCabecera = true;
			}
		});
	}

	#extraerLineas(lineasJson) {

		this.#datos.lineas = lineasJson.map((linea, numeroPosicion) => {
			let lineaSap = new LineaDevolucionSap(this.#transmision, linea, numeroPosicion);

			this.#metadatos.totales.lineas++;
			this.#metadatos.totales.cantidad += lineaSap.cantidad;

			if (lineaSap.esEstupefaciente()) {
				this.#metadatos.totales.lineasEstupe++;
				this.#metadatos.totales.cantidadEstupe += lineaSap.cantidad;
			}

			if (lineaSap.tieneIncidencias()) {
				this.#metadatos.totales.lineasIncidencias++;
				this.#metadatos.totales.cantidadIncidencias += lineaSap.cantidad;
			}

			if (lineaSap.numeroDevolucionSap) {
				if (!this.#metadatos.numerosDevolucionSap.includes(lineaSap.numeroDevolucionSap))
					this.#metadatos.numerosDevolucionSap.push(lineaSap.numeroDevolucionSap)
			}

			return lineaSap;
		});
	}

	/**
	 * Indica si esta devolución contiene lineas descartadas por SAP
	 */
	esDeLineasDescartadas() {
		return this.#metadatos.lineasDescartadas;
	}

	esDeClienteDesconocido() {
		return this.#metadatos.clienteNoExiste;
	}

	getNumeroObjetoDevolucion() {
		return this.#metadatos.numeroObjetoDevolucion;
	}

	insertarLineaDescartada(linea) {
		this.#datos.lineas.push(linea);
	}

	getLineas() {
		return this.#datos.lineas;
	}

	getMetadatos() {
		return this.#metadatos;
	}

	getDatos() {
		return this.#datos;
	}

	generarJSON(tipoReceptor = 'respuestaCliente') {
		let json = {};
		if (this.#datos.codigoCliente) json.codigoCliente = this.#datos.codigoCliente;
		if (this.#datos.numeroDevolucion) json.numeroDevolucion = this.#datos.numeroDevolucion;
		if (this.#datos.fechaDevolucion) json.fechaDevolucion = this.#datos.fechaDevolucion;

		if (this.#datos.codigoRecogida) json.codigoRecogida = this.#datos.codigoRecogida;
		if (this.#datos.numeroAlbaranAbono) json.numeroAlbaranAbono = this.#datos.numeroAlbaranAbono;
		if (this.#datos.fechaAlbaranAbono) json.fechaAlbaranAbono = this.#datos.fechaAlbaranAbono;
		if (this.#datos.empresaFacturadora) json.empresaFacturadora = this.#datos.empresaFacturadora;
		if (this.#datos.observaciones) json.observaciones = this.#datos.observaciones;

		json.lineas = this.#datos.lineas.map(linea => linea.generarJSON ? linea.generarJSON() : linea)
		if (this.#datos.incidencias.length) json.incidencias = this.#datos.incidencias;

		return json;
	}

}


module.exports = RespuestaDevolucionSap;