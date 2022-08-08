const ServidorWebSocketInterior = require('global/websocket/websocketInterior');
const ServidorWebSocketExterior = require('global/websocket/websocketExterior');
const ClienteWorker = require('global/websocket/clienteWebsocketInterior');
let clienteWorker = null;
let servidorExterior = null;

module.exports = {
	interior: async () => {
		return new ServidorWebSocketInterior()
	},
	exterior: () => {
		if (!servidorExterior) servidorExterior =  new ServidorWebSocketExterior()
		return servidorExterior;
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
