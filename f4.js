'use strict';

const axios = require('axios');
const clone = require('clone');

console.log('Vamos a chutar pedidos', new Date());


let clientes = ["10122059", "10115082", "290170151"]
let materiales = ["7610700607237", "8470001914569", "8413853500009", "3282770204667", "8470001582423", "8470007295662"]
let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJBbGVqYW5kcm9fQUMiLCJhdWQiOiJIRUZBTUUiLCJleHAiOjE2MzMwNzIzOTcsImdydXBvcyI6WyJGRUQzX0JBTEFOQ0VBRE9SIiwiRkVEM19DT05TVUxUQVMiLCJGRUQzX0lOU1RBTkNJQVMiLCJGRUQzX1JFVFJBTlNNSVNJT04iLCJGRUQzX1NJTVVMQURPUiIsIkZFRDNfVE9LRU5TIl0sImlhdCI6MTYzMjk4NTk5Nn0.nzAvPPkJjEeXq7SP5NwYz5-HcC0RmNYiii7PlWzABL4"


let cabeceras = {
	'content-type': 'application/json',
	'authorization': 'Bearer ' + token,
	'x-simulacion-usuario': '',
	'x-simulacion-dominio': 'FEDICOM',
}

let pedido = {
	"codigoCliente": "",
	"numeroPedidoOrigen": "",
	"lineas": [
		{
			"orden": 1,
			"codigoArticulo": "",
			"cantidad": 1
		}
	]
}

let parametrosAxios = {
	method: 'POST',
	url: 'https://fedicom3-dev.hefame.es/pedidos',
	headers: {},
	body: {}
}


let numeroPedidoOrigen = 1;
let prefijoNumeroPedidoOrigen = 'PRUEBA-H-';
let promesas = [];


clientes.forEach(cliente => {
	materiales.forEach(material => {

		let clonPedido = clone(pedido);
		let clonCabeceras = clone(cabeceras);
		let clonParametrosAxios = clone(parametrosAxios);

		clonCabeceras['x-simulacion-usuario'] = cliente.startsWith('2901') ? 'BF' + cliente : cliente + '@hefame';
		clonPedido.codigoCliente = cliente.substr( cliente.length-5);
		clonPedido.numeroPedidoOrigen = prefijoNumeroPedidoOrigen + (numeroPedidoOrigen);
		clonPedido.lineas[0].codigoArticulo = material;

		clonParametrosAxios.data = clonPedido;
		clonParametrosAxios.headers = clonCabeceras;


		console.log(`> ${prefijoNumeroPedidoOrigen + (numeroPedidoOrigen)} > ${cliente.substr(cliente.length - 5)} > ${material}`)
		promesas.push(axios(clonParametrosAxios));

		numeroPedidoOrigen++;
	})
})

Promise.allSettled(promesas).then(resultados => {

	resultados.forEach((resultado , i) => {
		if (resultado.status === 'fulfilled') {
			let codigoEstadoHttp = resultado.value?.status;
			let idTransmision = resultado.value?.headers?.['x-txid'];
			let numeroPedidoOrigen = resultado.value?.data?.numeroPedidoOrigen;
			let numeroPedido = resultado.value?.data?.numeroPedido;
			console.log(`@${i} < ${numeroPedidoOrigen} < ${codigoEstadoHttp} < ${numeroPedido} < ${idTransmision}`);
		} else {
			console.log(`@${i} <<<< ${resultado.reason}`);
		}

	});
});










