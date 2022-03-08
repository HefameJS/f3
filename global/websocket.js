const ServidorWebSocketInterior = require('global/websocket/websocketInterior');
const ServidorWebSocketExterior = require('global/websocket/websocketExterior');
const ClienteWorker = require('global/websocket/clienteWebsocketInterior');
let clienteWorker = null;

module.exports = {
	arrancarServicioInterior: async () => {
		return new ServidorWebSocketInterior()
	},
	arrancarServicioExterior: () => {
		return new ServidorWebSocketExterior()
	},
	enviarMensajeAColector: async (mensaje) => {

		try {
			if (!clienteWorker) clienteWorker = new ClienteWorker();
			clienteWorker.enviarMensaje(mensaje)
		} catch (error) {
			L.err('Error al enviar mensaje al servicio websocket colector', error);
		}
		
		
	}

	
};
