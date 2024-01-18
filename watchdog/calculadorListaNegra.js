'use strict';
const C = global.config;
const L = global.logger;
const M = global.mongodb;

let idIntervalo = null;


module.exports = async function () {

	let intervaloEnEjecucion = false;

	const funcionListaNegra = async () => {
		intervaloEnEjecucion = true;
		try {

			let ahora = new Date();



			let inicio = new Date((new Date()).setHours(0, 0, 0, 0));
			let fin = new Date((new Date()).setHours(C.listaNegra.horaCorte, 0, 0, 0));

			if (ahora.getHours() < C.listaNegra.horaCorte) {
				L.t(['La lista negra de clientes se recalculará a partir de las ', fin]);
				return;
			}

			let listaNegra = await M.db.collection('tx').aggregate([
				{
					$match: {
						'flags.transmision.autenticacion.dominio': "FEDICOM",
						type: { $in: [10, 12] },
						status: 9900,
						createdAt: {
							$gt: inicio,
							$lt: fin
						}
					}
				}, {
					$group: {
						_id: '$clientRequest.body.codigoCliente',
						count: { $sum: 1 }
					}
				}, {
					$match: {
						count: { $gte: C.listaNegra.limitePedido }
					}
				}
			]).toArray();

			if (listaNegra && Array.isArray(listaNegra)) {
				let listaClientes = listaNegra.map(e => e._id);
				L.t(['Lista negra de clientes recalculada', listaClientes]);
				let result = await M.db.collection('configuracion').updateOne({ _id: "listaNegra" }, {
					$set: {
						ultimaActualizacionClientes: new Date(),
						clientes: listaClientes,
					}
				});

				L.t(['Lista negra de clientes grabada', 'Modificada:', Boolean(result.modifiedCount)]);
			}



		} catch (errorMongo) {
			L.e(['Capturado error al recalcular la lista negra de clientes', errorMongo]);
		} finally {
			intervaloEnEjecucion = false;
		}


	}

	idIntervalo = setInterval(funcionListaNegra, C.listaNegra.intervaloRecalculo);
	funcionListaNegra();

	return idIntervalo;
}