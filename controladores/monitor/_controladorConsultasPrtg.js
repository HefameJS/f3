'use strict';
//const C = global.C;
const L = global.L;
//const K = global.K;

// Interfaces
//const iTokens = require('global/tokens');
const iMongo = require('interfaces/_imongo/iMongo');
const Maestro = require('global/_maestro');

// Modelos
const SensorPrtg = require('modelos/_prtg/SensorPrtg');


// GET /prtg/estadoPedidos
exports.consultaEstadoPedidos = async function (req, res) {

	let txId = req.txId;

	L.xi(txId, ['Consulta SENTINEL - EstadoPedidos']);


	let fecha = new Date();
	fecha.setHours(0, 0, 0, 0);

	let pipeline = [
		{
			$match: {
				type: 10,
				createdAt: { $gte: fecha }
			}
		},
		{
			$group: {
				_id: "$status",
				transmisiones: {
					$sum: 1
				}
			}
		}
	]



	let sensorPrtg = new SensorPrtg();

	try {

		let resultado = await iMongo.consultaTx.agregacion(pipeline);

		let canales = Maestro.transmisiones.pedidos.estados.map( estado => {
			let valorEstado = resultado.find( e => e._id === estado.codigo);
			return {
				nombre: estado.descripcionCorta,
				valor: valorEstado?.transmisiones || 0
			}

		})

		canales.forEach(canal => {
			sensorPrtg.resultado(canal.nombre, canal.valor, 'Count');
		});



		
	} catch (errorMongo) {
		L.xw(txId, ['Ocurrió un error al realizar la agregación en mongoDB', errorMongo])
		sensorPrtg.ponerEnError('Ocurrió un error al realizar la agregación en mongoDB');
		return;
	}

	res.status(200).json(sensorPrtg);


}

