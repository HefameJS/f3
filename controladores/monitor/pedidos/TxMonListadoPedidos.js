'use strict';
const K = global.K;
const M = global.M;


const TransmisionLigera = require('modelos/transmision/TransmisionLigera');
const ErrorFedicom = require('modelos/ErrorFedicom');

const ResultadoTransmisionLigera = require('modelos/transmision/ResultadoTransmisionLigera');
const CondicionesAutorizacion = require('modelos/transmision/CondicionesAutorizacion');
const { EJSON } = require('bson');

/**
 * EJEMPLO DE CONSULTA
 * {
 * 		"filtro": {
 * 			"_id": { "$oid": "5EC290F44783DB681D4E5E04" }
 * 		},
 * 		"proyeccion": {"pedido": 1},
 *  	"orden": {},
 * 		"skip": 0,
 * 		"limite": 10
 * }
 * NOTA: El campo filtro espera un objeto EJSON
 */

/**
 * Clase que representa una transmisión de una solicitud de listado de pedidos.
 */
class TxMonListadoPedidos extends TransmisionLigera {


	// @Override
	async operar() {

		let consultaRealizada = this.req.body;
		this.log.info('Solicitud de listado de pedidos con filtros', consultaRealizada);

		try {
			if (consultaRealizada.filtro) consultaRealizada.filtro = EJSON.deserialize(consultaRealizada.filtro, { relaxed: false })
		} catch (errorDeserializadoEJSON) {
			this.log.warn('Error en la deserialización de la consulta EJSON', errorDeserializadoEJSON);
			let errorFedicom = new ErrorFedicom('HTTP-400', 'Error al interpretar la consulta de pedidos', 400);
			return errorFedicom.generarResultadoTransmision();
		}

		// Forzamos la consulta para que devuelva solo pedidos.
		if (!consultaRealizada.filtro) consultaRealizada.filtro = {}
		consultaRealizada.filtro.tipo = K.TIPOS.CREAR_PEDIDO;

		let filtro = consultaRealizada.filtro;
		let opciones = {};
		if (consultaRealizada.proyeccion) opciones.projection = consultaRealizada.proyeccion;
		if (consultaRealizada.orden) opciones.sort = consultaRealizada.orden;
		if (consultaRealizada.skip) opciones.skip = consultaRealizada.skip;
		if (consultaRealizada.limite) opciones.limit = consultaRealizada.limite;


		this.log.debug('Se realiza la consulta a MongoDB:', filtro, opciones)

		let numeroResultados = await M.col.transmisiones.count( filtro)

		let resultados = await M.col.transmisiones.find(filtro, opciones).toArray();
		return new ResultadoTransmisionLigera(200, { totalResultados: numeroResultados, resultados });

	}

}


TxMonListadoPedidos.CONDICIONES_AUTORIZACION = new CondicionesAutorizacion({
	grupoRequerido: 'FED3_CONSULTAS'
});


module.exports = TxMonListadoPedidos;