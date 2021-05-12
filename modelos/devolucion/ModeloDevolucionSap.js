'use strict';
const C = global.config;
const L = global.logger;
const K = global.constants;

// Interfaces
const iFlags = require('interfaces/iflags/iFlags');
const ErrorFedicom = require('modelos/ErrorFedicom');

// Helpers
const LineaDevolucionSap = require('./ModeloLineaDevolucionSap');


class ModeloDevolucionSap {
	/**
	 * Construye el objeto de la petición de devolución a partir de la peticion HTTP del cliente.
	 */
	constructor(json, txId) {

		L.xt(txId, ['Instanciando objeto Devolucion Sap con los datos del cuerpo HTTP', json]);

		this.metadatos = {
			creaOrdenLogistica: Boolean(json.codigorecogida),
			clienteNoExiste: false,
			devolucionDuplicadaSap: false,
			puntoEntrega: json.sap_punto_entrega || null,
			numerosDevolucionSap: [],
			totales: {
				lineas: 0,
				lineasIncidencias: 0,
				lineasEstupe: 0,
				cantidad: 0,
				cantidadIncidencias: 0,
				cantidadEstupe: 0
			}
		}

		// Copiamos las propiedades de la CABECERA que son relevantes		
		this.codigoCliente = json.codigocliente;
		this.numeroDevolucion = json.numerodevolucion || null;
		this.fechaDevolucion = json.fechadevolucion || null;
		this.codigoRecogida = json.codigorecogida || null;
		this.numeroAlbaranAbono = json.numeroalbaranabono || null;
		this.fechaAlbaranAbono = json.fechaalbaranabono || null;
		this.empresaFacturadora = json.empresafacturadora || null;
		this.observaciones = json.observaciones || null;

		// Algunas incidencias tienen un tratamiento especial
		let incidencias = [];
		json.incidencias.forEach(incidencia => {
			// Las incidencias de tipo "Cliente no existe" son un caso especial que debe tratarse.
			// Si aparece en algun objeto de devolución de SAP, la respuesta del cliente debe ser un
			// error 400, con únicamente la incidencia

			// Si el fallo del cliente lo detecta la pre-BAPI la incidencia será:
			// {"codigo": "DEV-ERR-002", "descripcion": "El parametro CodigoClientee es invalido" }
			if (incidencia.codigo === "DEV-ERR-002") {
				L.xw(txId, ['Se encuentra la incidencia (DEV-ERR-002) en SAP']);
				this.metadatos.clienteNoExiste = true;
				incidencias.push({
					codigo: "DEV-ERR-002",
					descripcion: 'El parámetro "codigoCliente" es inválido'
				});
			}
			// Pero si el fallo del cliente lo detecta la BAPI, la incidencia será:
			// {"codigo": "", "descripcion"; "Cliente desconocido"}
			if (incidencia.descripcion === "Cliente desconocido") {
				L.xw(txId, ['Se encuentra la incidencia (Cliente desconocido) en SAP']);
				this.metadatos.clienteNoExiste = true;
				incidencias.push({
					codigo: "DEV-ERR-002",
					descripcion: 'El parámetro "codigoCliente" es inválido'
				});
			}

			// Si aparece la incidencia 'Devolución duplicada', la suprimimos de la respuesta al cliente 
			// y levantamos el flag 'DUPLICADO_SAP' {"codigo": "", "descripcion"; "Devolución duplicada"}
			if (incidencia.descripcion === "Devolución duplicada") {
				L.xw(txId, ['Se encontró la incidencia de "Devolución duplicada" en la respuesta de SAP']);
				this.metadatos.devolucionDuplicadaSap = true;

				return;
			}

			incidencias.push(incidencia);
		});
		if (incidencias.length > 0) this.incidencias = incidencias;

		// Extracción de información de las lineas
		this.lineas = json.lineas.length === 0 ? [] : json.lineas.map((linea, index) => {
			let lineaSap = new LineaDevolucionSap(linea, txId, index);
			let totales = this.metadatos.totales;
			totales.lineas++;
			totales.cantidad += lineaSap.cantidad;

			if (lineaSap.valeEstupefaciente) {
				totales.lineasEstupe++;
				totales.cantidadEstupe += lineaSap.cantidad;
			}

			if (lineaSap.incidencias && lineaSap.incidencias.length > 0) {
				totales.lineasIncidencias++;
				totales.cantidadIncidencias += lineaSap.cantidad;
			}

			if (lineaSap.numeroDevolucionSap) {
				if (!this.metadatos.numerosDevolucionSap.includes(lineaSap.numeroDevolucionSap))
					this.metadatos.numerosDevolucionSap.push(lineaSap.numeroDevolucionSap)
			}

			return lineaSap;
		});

	}

	/**
	 * Indica si esta devolución contiene lineas descartadas por SAP
	 */
	esDeLineasDescartadas() {
		// Si no se indica el número de devolución, es que las líneas van excluidas.
		return !this.numeroDevolucion;
	}


	generarJSON() {
		let json = {};
		if (this.codigoCliente) json.codigoCliente = this.codigoCliente;
		if (this.numeroDevolucion) json.numeroDevolucion = this.numeroDevolucion;
		if (this.fechaDevolucion) json.fechaDevolucion = this.fechaDevolucion;

		if (this.codigoRecogida) json.codigoRecogida = this.codigoRecogida;
		if (this.numeroAlbaranAbono) json.numeroAlbaranAbono = this.numeroAlbaranAbono;
		if (this.fechaAlbaranAbono) json.fechaAlbaranAbono = this.fechaAlbaranAbono;
		if (this.empresaFacturadora) json.empresaFacturadora = this.empresaFacturadora;
		if (this.observaciones) json.observaciones = this.observaciones;

		json.lineas = this.lineas.map(linea => linea.generarJSON ? linea.generarJSON() : linea)
		if (this.incidencias) json.incidencias = this.incidencias;

		return json;
	}


	static condensar(txId, devolucionesSap, devolucionCliente) {
		
		
		// Las siguientes variables las rellenaremos recorriendo las distintas devoluciones dadas por SAP.
		let cuerpoRespuestaHttp = [];
		let numerosDevolucionSap = [];
		let numeroDevolucion = null;
		let devolucionDuplicadaSap = false; 	// Si en alguna devolucion aparece la incidencia de duplicado SAP.
		let clienteNoExiste = false;			// Si en alguna devolucion aparece la incidencia de Cliente no existe.
		let puntoEntrega = null;				// Si encontramos el punto de entrega
		let esDevolucionParcial = false;		// Si no todas las lineas han sido aceptadas
		let esRechazoTotal = true;				// Si todas las linas se han rechazado
		let creaOrdenLogistica = false;			// Si aparece el numero de la orden de recogida
		let totales = {
			lineas: 0,
			lineasExcluidas: 0,
			lineasIncidencias: 0,
			lineasEstupe: 0,
			cantidad: 0,
			cantidadExcluida: 0,
			cantidadIncidencias: 0,
			cantidadEstupe: 0
		}

		devolucionesSap.forEach(devolucionSap => {

			// Si el cliente no existe, se va a rechazar toda la transmision
			// por lo que podemos parar de procesar
			if (clienteNoExiste || devolucionSap.metadatos.clienteNoExiste) {
				clienteNoExiste = true;
				return;
			}

			// Si la devolucion es de lineas descartadas por SAP, le añadimos a la misma
			// las líneas descartadas por el concentrador si las hay.
			if (devolucionSap.esDeLineasDescartadas()) {

				esDevolucionParcial = true;

				let totalesExcluidos = devolucionSap.metadatos.totales;
				let lineasDescartadasConcentrador = devolucionCliente.generarListaLineasExcluidas();

				lineasDescartadasConcentrador.forEach(lineaDescartada => {
					devolucionSap.lineas.push(lineaDescartada)

					totalesExcluidos.lineas++;
					totalesExcluidos.lineasIncidencias++;
					totalesExcluidos.cantidad += lineaDescartada.cantidad || 0;
					totalesExcluidos.cantidadIncidencias += lineaDescartada.cantidad || 0;

					if (lineaDescartada.valeEstupefaciente) {
						totalesExcluidos.lineasEstupe++;
						totalesExcluidos.cantidadEstupe += lineaDescartada.cantidad || 0;
					}
				});

				totales.lineas += totalesExcluidos.lineas;
				totales.lineasExcluidas += totalesExcluidos.lineas;
				totales.lineasIncidencias += totalesExcluidos.lineasIncidencias;
				totales.lineasEstupe += totalesExcluidos.lineasEstupe;
				totales.cantidad += totalesExcluidos.cantidad;
				totales.cantidadExcluida += totalesExcluidos.cantidad;
				totales.cantidadIncidencias += totalesExcluidos.cantidadIncidencias;
				totales.cantidadEstupe += totalesExcluidos.cantidadEstupe;

			} else {
				numeroDevolucion = devolucionSap.numeroDevolucion;
				numerosDevolucionSap = numerosDevolucionSap.concat(devolucionSap.metadatos.numerosDevolucionSap);
				esRechazoTotal = false;

				let totalesIncluidos = devolucionSap.metadatos.totales;

				totales.lineas += totalesIncluidos.lineas;
				totales.lineasIncidencias += totalesIncluidos.lineasIncidencias;
				totales.lineasEstupe += totalesIncluidos.lineasEstupe;
				totales.cantidad += totalesIncluidos.cantidad;
				totales.cantidadIncidencias += totalesIncluidos.cantidadIncidencias;
				totales.cantidadEstupe += totalesIncluidos.cantidadEstupe;
			}


			devolucionDuplicadaSap = devolucionDuplicadaSap || devolucionSap.metadatos.devolucionDuplicadaSap;
			puntoEntrega = puntoEntrega || devolucionSap.metadatos.puntoEntrega;
			creaOrdenLogistica = creaOrdenLogistica || devolucionSap.metadatos.creaOrdenLogistica;

			cuerpoRespuestaHttp.push(devolucionSap.generarJSON())

		})

		// En el caso de encontrar la incidencia de que el cliente no existe, devolvemos el error
		if (clienteNoExiste) {
			L.xi(txId, 'Se encontró la incidencia de "Cliente desconocido" en la respuesta de SAP - Devolución rechazada');
			let errorFedicom = new ErrorFedicom('DEV-ERR-002', 'El parámetro "codigoCliente" es inválido', 400);
			let respuestaClienteError = errorFedicom.getErrores();
			return {
				cuerpoRespuestaHttp: respuestaClienteError,
				codigoRespuestaHttp: 400,
				estadoTransmision: K.TX_STATUS.RECHAZADO_SAP,
				numerosDevolucion: []
			};
		}
		// RETURN


		// Es posible que todas las lineas enviadas a SAP hayan vuelto OK, pero que el concentrador no le haya
		// enviado todas las lineas por encontrar errores. En tal caso, las anadimos
		if (!esDevolucionParcial && devolucionCliente.contieneLineasExcluidas()) {
			esDevolucionParcial = true;
			cuerpoRespuestaHttp.push(devolucionCliente.generarRespuestaDeTodasLasLineasSonInvalidas());
		}


		// Levantamos Flags
		if (devolucionDuplicadaSap) iFlags.set(txId, C.flags.DUPLICADO_SAP);
		if (puntoEntrega) iFlags.set(txId, C.flags.PUNTO_ENTREGA, puntoEntrega);

		if (creaOrdenLogistica) iFlags.set(txId, C.flags.GENERA_RECOGIDA);
		if (totales.lineasEstupe) iFlags.set(txId, C.flags.ESTUPEFACIENTE);

		if (esRechazoTotal) iFlags.set(txId, C.flags.DEVOLUCION_RECHAZO_TOTAL);
		else if (esDevolucionParcial) iFlags.set(txId, C.flags.DEVOLUCION_PARCIAL);

		iFlags.set(txId, C.flags.TOTALES, totales);


		let codigoRespuestaHttp = esRechazoTotal ? 206 : (esDevolucionParcial ? 206 : 201);
		let estadoTransmision = esRechazoTotal ? K.TX_STATUS.DEVOLUCION.RECHAZO_TOTAL : (esDevolucionParcial ? K.TX_STATUS.DEVOLUCION.PARCIAL : K.TX_STATUS.OK);


		return {
			cuerpoRespuestaHttp,
			codigoRespuestaHttp,
			estadoTransmision,
			numerosDevolucionSap,
			numeroDevolucion
		}
	}
}


module.exports = ModeloDevolucionSap;