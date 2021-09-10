'use strict';
const ErrorFedicom = require('modelos/ErrorFedicom');
const Modelo = require('modelos/transmision/Modelo');
const LineaDevolucionSap = require('./LineaDevolucionSap');


class RespuestaDevolucionSap extends Modelo {


	metadatos = {
		errores: new ErrorFedicom(),
		respuestaIncomprensible: false,
		numeroObjetosDevolucion: 0,			// (int) 

		lineasRechazadas: [],				// (Array[LineaDevolucionSap]) Lista de lineas rechazadas por SAP
		todasLineasRechazadas: true,		// (bool) Indica si todas las lineas devueltas han sido rechazadas

		clienteNoExiste: false,				// (bool) Indica si SAP ha indicado la incidencia de que el cliente no existe
		devolucionDuplicadaSap: false,		// (bool) Indica si SAP ha indicado la incidencia de que la devolución es duplicada
		incidenciasCabeceraSap: false,		// (bool) Indica si aparecen incidencias de cabecera "no controladas" en la respuesta de SAP
		arrayDeErroresSap: null,			// (null|Array) Indica si SAP ha devuelto un array de errores en vez de objetos de devolución

		creaOrdenLogistica: false,			// (bool) Indica si en este objeto se indica un código de orden de logística
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


	codigoCliente;
	numeroDevolucion;
	fechaDevolucion;
	codigoRecogida;
	numeroAlbaranAbono;
	fechaAlbaranAbono;
	empresaFacturadora;
	observaciones;
	lineas;



	/**
	 * Construye el objeto de la petición de devolución a partir de la peticion HTTP de SAP.
	 */
	constructor(transmision) {

		super(transmision);

		let json = this.transmision.sap.getRespuesta();

		if (!Array.isArray(json) || !json.length) {
			this.log.err('SAP devuelve un cuerpo de respuesta que NO es un array:');
			this.metadatos.error.insertar('DEV-ERR-999', 'No hemos podido grabar la devolución, reinténtelo mas tarde.');
			this.metadatos.respuestaIncomprensible = true;
			return;
		}

		// Comprobación inicial de que SAP no nos está indicando un array de errores.
		
		if (json[0]?.codigo || json[0]?.descripcion ) {
			
			this.metadatos.arrayDeErroresSap = json;

			// Vemos si es un error concreto de fallo del dominio. Si lo es, no lo ocultamos al cliente.
			// El resto de errores (no sabemos que errores pueden venir de SAP), los ocultamos
			// { "codigo" : "AUTH-999", "descripcion" : "No existe el dominio" }
			if (json[0]?.codigo === "AUTH-999" || json[0]?.descripcion === "No existe el dominio") {
				this.log.warn('SAP indica que no se pueden crear devoluciones con el dominio');
				this.metadatos.errores.insertar('DEV-ERR-999', 'No existe el dominio.');
			} else{
				this.log.warn('SAP indica un array de errores en su respuesta', json);
				this.metadatos.errores.insertar('DEV-ERR-999', 'No hemos podido grabar la devolución, reinténtelo mas tarde.');
			}

			return;
		}


		this.log.info(`SAP ha devuelto un total de ${json.length} objetos de devolución`);
		this.metadatos.numeroObjetosDevolucion = json.length;

		json.forEach((devolucionSap, indice) => {
			this.log.info(`Objeto Devolución #${indice}: Analizando respuesta de devolución con los datos obtenidos de SAP`);

			let esRechazo = !Boolean(devolucionSap.numerodevolucion);
			if (esRechazo) {
				this.log.warn(`Objeto Devolución #${indice}: No indica numero de devolución -> las líneas has sido descartadas por SAP`);
			} 

			if (devolucionSap.codigocliente) this.codigoCliente = devolucionSap.codigocliente;
			if (devolucionSap.numerodevolucion) this.numeroDevolucion = devolucionSap.numerodevolucion;
			if (devolucionSap.fechadevolucion) this.fechaDevolucion = devolucionSap.fechadevolucion;
			if (devolucionSap.codigorecogida) {
				this.codigoRecogida = devolucionSap.codigorecogida;
				this.metadatos.creaOrdenLogistica = true;
			}
			if (devolucionSap.numeroalbaranabono) this.numeroAlbaranAbono = devolucionSap.numeroalbaranabono;
			if (devolucionSap.fechaalbaranabono) this.fechaAlbaranAbono = devolucionSap.fechaalbaranabono;
			if (devolucionSap.empresafacturadora) this.empresaFacturadora = devolucionSap.empresafacturadora;
			if (devolucionSap.observaciones) this.observaciones = devolucionSap.observaciones;
			if (devolucionSap.sap_punto_entrega) this.metadatos.puntoEntrega = devolucionSap.sap_punto_entrega;

			this.#procesarIncidenciasSap(devolucionSap.incidencias, indice);
			this.#extraerLineas(devolucionSap.lineas, esRechazo, indice);

		});

	}


	/**
	 * Realiza un saneamiento de las incidencias que nos manda SAP
	 * @param {*} incidenciasJson 
	 */
	#procesarIncidenciasSap(incidenciasJson, posicionObjeto) {

		if (!Array.isArray(incidenciasJson) || !incidenciasJson.length) {
			return;
		}

		incidenciasJson.forEach(incidencia => {
			// CLIENTE NO EXISTE
			// Hay 2 modos de encontrarse esta incidencia, en funcion de donde se detecte:
			// PRE-BAPI => {"codigo": "DEV-ERR-002", "descripcion": "El parametro CodigoClientee es invalido" }
			// BAPI     => {"codigo": "", "descripcion"; "Cliente desconocido"}
			if (incidencia.codigo === "DEV-ERR-002" || incidencia.descripcion === "Cliente desconocido") {
				this.log.info(`Objeto devolucion ${posicionObjeto}: Se encuentra la incidencia de cliente desconocido => "${incidencia.descripcion}"`);
				this.metadatos.errores.insertar('DEV-ERR-002', 'El parámetro "codigoCliente" es inválido');
				this.metadatos.clienteNoExiste = true;
			}
			// DEVOLUCION DUPLICADA
			// {"codigo": "", "descripcion"; "Devolución duplicada"}
			else if (incidencia.descripcion === "Devolución duplicada") {
				this.log.info(`Objeto devolucion ${posicionObjeto}: Se encuentra la incidencia de devolucion duplicada`);
				this.metadatos.errores.insertar('DEV-WARN-999', 'La devolución ya estaba registrada en el sistema');
				this.metadatos.devolucionDuplicadaSap = true;
			}
			// OTRAS INCIDENCIAS
			else {
				if (!incidencia.codigo) incidencia.codigo = 'DEV-ERR-999';
				this.metadatos.errores.insertar(incidencia);
				this.metadatos.incidenciasCabeceraSap = true;
			}
		});
	}

	#extraerLineas(lineasJson, sonLineasRechazadas, posicionObjeto) {

		if (!Array.isArray(lineasJson) || !lineasJson.length) {
			return;
		}

		if (!sonLineasRechazadas && !this.lineas) {
			this.lineas = [];
		}

		lineasJson.forEach((linea, numeroPosicion) => {
			let lineaSap = new LineaDevolucionSap(this.transmision, linea, numeroPosicion);
			if (sonLineasRechazadas) {
				this.metadatos.lineasRechazadas.push(lineaSap)
			} else {
				this.lineas.push(lineaSap);
				this.metadatos.todasLineasRechazadas = false;
			}
			

			this.metadatos.totales.lineas++;
			this.metadatos.totales.cantidad += lineaSap.cantidad;

			if (lineaSap.metadatos.estupefaciente) {
				this.metadatos.totales.lineasEstupe++;
				this.metadatos.totales.cantidadEstupe += lineaSap.cantidad;
			}

			if (lineaSap.incidencias) {
				this.metadatos.totales.lineasIncidencias++;
				this.metadatos.totales.cantidadIncidencias += lineaSap.cantidad;
			}

			if (lineaSap.metadatos.numeroDevolucionSap) {
				if (!this.metadatos.numerosDevolucionSap.includes(lineaSap.metadatos.numeroDevolucionSap))
					this.metadatos.numerosDevolucionSap.push(lineaSap.metadatos.numeroDevolucionSap)
			}
		});
	}

	insertarLineasRechazadas(lineas) {
		if (Array.isArray(lineas) && lineas.length) {

			lineas.forEach(lineaRechazada => {
				this.metadatos.lineasRechazadas.push(lineaRechazada);

				this.metadatos.totales.lineas++;
				this.metadatos.totales.lineasIncidencias++;
				if (lineaRechazada.valeEstupefaciente) this.metadatos.totales.lineasEstupe++;
				if (lineaRechazada > 0) {
					this.metadatos.totales.cantidad += lineaRechazada.cantidad;
					this.metadatos.totales.lineasIncidencias += lineaRechazada.cantidad;
					if (lineaRechazada.valeEstupefaciente) this.metadatos.totales.cantidadEstupe += lineaRechazada.cantidad;
				}
			})


			this
		}
	}

	haSidoCompletamenteRechazada() {
		return this.metadatos.clienteNoExiste || this.metadatos.todasLineasRechazadas || this.metadatos.arrayDeErroresSap?.length
	}

	generarJSON(tipoReceptor) {
		if (this.metadatos.respuestaIncomprensible || this.metadatos.clienteNoExiste || this.metadatos.arrayDeErroresSap?.length) {
			return this.metadatos.errores.getErrores() || [];
		}

		let json = {
			codigoCliente: this.codigoCliente
		};
		let jsonB = {
			codigoCliente: this.codigoCliente
		};

		if (this.metadatos.lineasRechazadas.length) {
			jsonB.lineas = this.metadatos.lineasRechazadas.map(l => l.generarJSON(tipoReceptor))
		}

		if (this.metadatos.todasLineasRechazadas) {
			return [jsonB];
		}

		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.numeroDevolucion) json.numeroDevolucion = this.numeroDevolucion;
		if (this.fechaDevolucion) json.fechaDevolucion = this.fechaDevolucion;
		if (this.codigoRecogida) json.codigoRecogida = this.codigoRecogida;
		if (this.numeroAlbaranAbono) json.numeroAlbaranAbono = this.numeroAlbaranAbono;
		if (this.fechaAlbaranAbono) json.fechaAlbaranAbono = this.fechaAlbaranAbono;
		if (this.empresaFacturadora) json.empresaFacturadora = this.empresaFacturadora;
		if (this.observaciones) json.observaciones = this.observaciones;
		if (this.metadatos.errores.tieneErrores()) json.incidencias = this.metadatos.errores.getErrores();
		if (this.lineas) json.lineas = this.lineas.map(l => l.generarJSON(tipoReceptor));

		if (this.metadatos.lineasRechazadas.length) {
			return [json, jsonB];
		} else {
			return [json];
		}

	}

}


module.exports = RespuestaDevolucionSap;