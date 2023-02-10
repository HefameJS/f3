'use strict';
const { default: axios } = require('axios');
const MongoDb = require('mongodb');

const main = async () => {
	console.log('Inicializando TEST Fedicom3', new Date());
	let cliente = new MongoDb.MongoClient('mongodb://res:c@res.hefame.es,res.hefame.es/res?replicaSet=res');

	cliente = await cliente.connect();

	let baseDatos = cliente.db('fedicom3');
	let tx = baseDatos.collection('tx');

	let cursor = tx.find({
		type: 10,
		status: 9900,
		createdAt: {
			$gte: new Date((new Date()).getTime() - 1 * 60 * 60 * 1000)
		}
	}, {
		projection: {
			clientRequest: 1
		}
	});

	const instance = axios.create({
		baseURL: 'https://fedicom3-dev.hefame.es/',
		timeout: 10000,
		headers: {
			'authorization': 'Bearer <TOKEN USUARIO HEFAME>',
			'software-id': '9001'
		}
	});

	let i = 1
	for await (const doc of cursor) {
		try {
			let body = doc.clientRequest.body;
			let auth = {
				'x-simulacion-dominio': doc.clientRequest.authentication.aud,
				'x-simulacion-usuario': doc.clientRequest.authentication.sub
			}

			let res = await instance.post('/pedidos', body, {
				headers: {
					...auth
				}
			})

			console.log(`${i}: ${res.status}`)
		} catch (err) {
			console.log(err)
		}
	}
}


main().catch(err => console.log(err));