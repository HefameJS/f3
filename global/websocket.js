

const ServidorWebSocketColector = require('global/websocket/websocketColector');
//const ServidorWebSocketConcentrador = require('global/websocket/websocketConcentrador');
const ClienteWorker = require('global/websocket/clienteWorker');
let clienteWorker = null;

module.exports = {
	arrancarServicioColector: async (puerto) => {
		return new ServidorWebSocketColector(puerto)
	},
	/*
	arrancarServicioConcentrador: (puerto) => {
		return new Promise((accept, reject) => {
			accept(new ServidorWebSocketConcentrador(puerto));
		})
	},
	*/
	enviarMensajeAColector: async (mensaje) => {

		if (!clienteWorker) clienteWorker = new ClienteWorker();
		clienteWorker.enviarMensaje(mensaje)
		
	}

	
};
